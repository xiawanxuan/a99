package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/datatypes"
	"pipe-monitor/internal/config"
	"pipe-monitor/internal/models"
	"pipe-monitor/internal/services/alert"
	"pipe-monitor/internal/services/analysis"
	"pipe-monitor/internal/services/pointcloud"
)

type AnalysisHandler struct {
	cfg            *config.Config
	alertDetector  *alert.AlertDetector
}

func NewAnalysisHandler(cfg *config.Config, alertDetector *alert.AlertDetector) *AnalysisHandler {
	return &AnalysisHandler{
		cfg:           cfg,
		alertDetector: alertDetector,
	}
}

func (h *AnalysisHandler) AnalyzeCrossSection(c *gin.Context) {
	var req struct {
		CrossSectionID string  `json:"cross_section_id"`
		PointCloudID   string  `json:"point_cloud_id" binding:"required"`
		Position       float64 `json:"position" binding:"required"`
		BIMModelID     string  `json:"bim_model_id" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var pc models.PointCloud
	if err := models.DB.First(&pc, "id = ?", req.PointCloudID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Point cloud not found"})
		return
	}

	points, err := pointcloud.LoadPLYFile(pc.FilePath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load point cloud: " + err.Error()})
		return
	}

	processor := pointcloud.NewProcessor(points)
	_, maxX, _, _, _, _ := processor.GetBounds()
	planePos := req.Position
	if planePos > maxX {
		planePos = maxX * 0.5
	}

	plane := analysis.NewPlaneFromPointNormal(planePos, 0, 0, 1, 0, 0)
	thickness := 0.05

	sectionResult := analysis.CutCrossSection(points, plane, thickness)

	if sectionResult.EllipseParams == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Insufficient points for ellipse fitting"})
		return
	}

	var crossSection models.CrossSection
	var baselineEllipse *models.EllipseParams

	if req.CrossSectionID != "" {
		if err := models.DB.First(&crossSection, "id = ?", req.CrossSectionID).Error; err == nil {
			json.Unmarshal(crossSection.BaselineEllipse, &baselineEllipse)
		}
	} else {
		baselineEllipse = sectionResult.EllipseParams
		ellipseJSON, _ := json.Marshal(baselineEllipse)
		bimModelUUID, _ := uuid.Parse(req.BIMModelID)

		crossSection = models.CrossSection{
			ID:              uuid.New(),
			BIMModelID:      bimModelUUID,
			Position:        req.Position,
			BaselineWidth:   baselineEllipse.A * 2,
			BaselineHeight:  baselineEllipse.B * 2,
			BaselineEllipse: datatypes.JSON(ellipseJSON),
		}

		if err := models.DB.Create(&crossSection).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create cross section: " + err.Error()})
			return
		}
	}

	deviationResult := analysis.ComputePointDeviations(sectionResult.Points, baselineEllipse)
	convergence, settlement := analysis.ComputeDeformation(sectionResult.EllipseParams, baselineEllipse)

	ellipseJSON, _ := json.Marshal(sectionResult.EllipseParams)
	statsJSON, _ := json.Marshal(deviationResult.Stats)

	pcUUID, _ := uuid.Parse(req.PointCloudID)

	measurement := &models.DeformationMeasurement{
		ID:             uuid.New(),
		CrossSectionID: crossSection.ID,
		PointCloudID:   pcUUID,
		Convergence:    convergence,
		Settlement:     settlement,
		MaxDeviation:   deviationResult.Stats.Max,
		AvgDeviation:   deviationResult.Stats.Mean,
		EllipseParams:  datatypes.JSON(ellipseJSON),
		DeviationStats: datatypes.JSON(statsJSON),
	}

	if err := models.DB.Create(measurement).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save measurement: " + err.Error()})
		return
	}

	h.alertDetector.DetectAndAlert(measurement, req.Position, pc.Phase)

	c.JSON(http.StatusOK, gin.H{
		"measurement":    measurement,
		"cross_section":  crossSection,
		"point_count":    sectionResult.PointCount,
		"ellipse_params": sectionResult.EllipseParams,
		"deviations":     deviationResult.Deviations,
		"stats":          deviationResult.Stats,
		"colors":         deviationResult.Colors,
		"section_points": sectionResult.Points,
	})
}

func (h *AnalysisHandler) ListMeasurements(c *gin.Context) {
	crossSectionID := c.Query("cross_section_id")
	pointCloudID := c.Query("point_cloud_id")

	var measurements []models.DeformationMeasurement
	query := models.DB

	if crossSectionID != "" {
		query = query.Where("cross_section_id = ?", crossSectionID)
	}
	if pointCloudID != "" {
		query = query.Where("point_cloud_id = ?", pointCloudID)
	}

	if err := query.Order("measured_at DESC").Find(&measurements).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, measurements)
}

func (h *AnalysisHandler) ListCrossSections(c *gin.Context) {
	bimModelID := c.Query("bim_model_id")
	var sections []models.CrossSection

	query := models.DB
	if bimModelID != "" {
		query = query.Where("bim_model_id = ?", bimModelID)
	}

	if err := query.Order("position ASC").Find(&sections).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, sections)
}

func (h *AnalysisHandler) CreateCrossSection(c *gin.Context) {
	var req struct {
		BIMModelID      string          `json:"bim_model_id" binding:"required"`
		Position        float64         `json:"position" binding:"required"`
		BaselineWidth   float64         `json:"baseline_width" binding:"required,gt=0"`
		BaselineHeight  float64         `json:"baseline_height" binding:"required,gt=0"`
		BaselineEllipse json.RawMessage `json:"baseline_ellipse" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	bimModelUUID, err := uuid.Parse(req.BIMModelID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid bim_model_id"})
		return
	}

	section := &models.CrossSection{
		ID:              uuid.New(),
		BIMModelID:      bimModelUUID,
		Position:        req.Position,
		BaselineWidth:   req.BaselineWidth,
		BaselineHeight:  req.BaselineHeight,
		BaselineEllipse: datatypes.JSON(req.BaselineEllipse),
	}

	if err := models.DB.Create(section).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, section)
}

func (h *AnalysisHandler) DeleteCrossSection(c *gin.Context) {
	id := c.Param("id")
	result := models.DB.Delete(&models.CrossSection{}, "id = ?", id)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Cross section not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

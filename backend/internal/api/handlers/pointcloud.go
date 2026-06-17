package handlers

import (
	"io"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"pipe-monitor/internal/config"
	"pipe-monitor/internal/models"
	"pipe-monitor/internal/services/pointcloud"
)

type PointCloudHandler struct {
	cfg *config.Config
}

func NewPointCloudHandler(cfg *config.Config) *PointCloudHandler {
	return &PointCloudHandler{cfg: cfg}
}

func (h *PointCloudHandler) List(c *gin.Context) {
	bimModelID := c.Query("bim_model_id")
	var pointClouds []models.PointCloud

	query := models.DB
	if bimModelID != "" {
		query = query.Where("bim_model_id = ?", bimModelID)
	}

	if err := query.Order("capture_time ASC").Find(&pointClouds).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, pointClouds)
}

func (h *PointCloudHandler) Get(c *gin.Context) {
	id := c.Param("id")
	var pc models.PointCloud
	if err := models.DB.First(&pc, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Point cloud not found"})
		return
	}
	c.JSON(http.StatusOK, pc)
}

func (h *PointCloudHandler) Upload(c *gin.Context) {
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to get file: " + err.Error()})
		return
	}
	defer file.Close()

	bimModelID := c.PostForm("bim_model_id")
	phase := c.PostForm("phase")
	captureTimeStr := c.PostForm("capture_time")

	if bimModelID == "" || phase == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bim_model_id and phase are required"})
		return
	}

	captureTime, err := time.Parse(time.RFC3339, captureTimeStr)
	if err != nil {
		captureTime = time.Now()
	}

	ext := filepath.Ext(header.Filename)
	fileName := uuid.New().String() + ext
	filePath := filepath.Join(h.cfg.PointCloudStorage, fileName)

	out, err := os.Create(filePath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create file: " + err.Error()})
		return
	}
	defer out.Close()

	if _, err := io.Copy(out, file); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file: " + err.Error()})
		return
	}

	points, err := pointcloud.LoadPLYFile(filePath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse PLY file: " + err.Error()})
		return
	}

	bimModelUUID, err := uuid.Parse(bimModelID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid bim_model_id: " + err.Error()})
		return
	}

	pc := &models.PointCloud{
		ID:          uuid.New(),
		BIMModelID:  bimModelUUID,
		Phase:       phase,
		FilePath:    filePath,
		PointCount:  len(points),
		CaptureTime: captureTime,
	}

	if err := models.DB.Create(pc).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save record: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, pc)
}

func (h *PointCloudHandler) Download(c *gin.Context) {
	id := c.Param("id")
	var pc models.PointCloud
	if err := models.DB.First(&pc, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Point cloud not found"})
		return
	}

	if _, err := os.Stat(pc.FilePath); os.IsNotExist(err) {
		c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
		return
	}

	c.FileAttachment(pc.FilePath, filepath.Base(pc.FilePath))
}

func (h *PointCloudHandler) Delete(c *gin.Context) {
	id := c.Param("id")
	var pc models.PointCloud
	if err := models.DB.First(&pc, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Point cloud not found"})
		return
	}

	if err := os.Remove(pc.FilePath); err != nil && !os.IsNotExist(err) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete file"})
		return
	}

	if err := models.DB.Delete(&pc).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/datatypes"
	"pipe-monitor/internal/config"
	"pipe-monitor/internal/models"
)

type BIMHandler struct {
	cfg *config.Config
}

func NewBIMHandler(cfg *config.Config) *BIMHandler {
	return &BIMHandler{cfg: cfg}
}

func (h *BIMHandler) List(c *gin.Context) {
	var models []models.BIMModel
	if err := models.DB.Find(&models).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, models)
}

func (h *BIMHandler) Get(c *gin.Context) {
	id := c.Param("id")
	var model models.BIMModel
	if err := models.DB.First(&model, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "BIM model not found"})
		return
	}
	c.JSON(http.StatusOK, model)
}

func (h *BIMHandler) Create(c *gin.Context) {
	var req struct {
		Name       string          `json:"name" binding:"required"`
		FilePath   string          `json:"file_path" binding:"required"`
		Length     float64         `json:"length" binding:"required,gt=0"`
		Width      float64         `json:"width" binding:"required,gt=0"`
		Height     float64         `json:"height" binding:"required,gt=0"`
		AxisPoints json.RawMessage `json:"axis_points" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	model := &models.BIMModel{
		ID:         uuid.New(),
		Name:       req.Name,
		FilePath:   req.FilePath,
		Length:     req.Length,
		Width:      req.Width,
		Height:     req.Height,
		AxisPoints: datatypes.JSON(req.AxisPoints),
	}

	if err := models.DB.Create(model).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, model)
}

func (h *BIMHandler) Update(c *gin.Context) {
	id := c.Param("id")
	var model models.BIMModel
	if err := models.DB.First(&model, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "BIM model not found"})
		return
	}

	if err := c.ShouldBindJSON(&model); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := models.DB.Save(&model).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, model)
}

func (h *BIMHandler) Delete(c *gin.Context) {
	id := c.Param("id")
	result := models.DB.Delete(&models.BIMModel{}, "id = ?", id)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "BIM model not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

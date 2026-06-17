package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"pipe-monitor/internal/models"
)

type AlertHandler struct{}

func NewAlertHandler() *AlertHandler {
	return &AlertHandler{}
}

func (h *AlertHandler) List(c *gin.Context) {
	acknowledged := c.Query("acknowledged")
	var alerts []models.Alert

	query := models.DB
	if acknowledged != "" {
		query = query.Where("acknowledged = ?", acknowledged == "true")
	}

	if err := query.Order("created_at DESC").Limit(100).Find(&alerts).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, alerts)
}

func (h *AlertHandler) Acknowledge(c *gin.Context) {
	id := c.Param("id")
	var alert models.Alert

	if err := models.DB.First(&alert, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Alert not found"})
		return
	}

	now := time.Now()
	alert.Acknowledged = true
	alert.AcknowledgedAt = &now

	if err := models.DB.Save(&alert).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, alert)
}

package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"pipe-monitor/internal/services/forecast"
)

type ForecastHandler struct {
	trendService *forecast.TrendService
}

func NewForecastHandler() *ForecastHandler {
	return &ForecastHandler{
		trendService: forecast.NewTrendService(),
	}
}

type ForecastRequest struct {
	History []struct {
		Date            string  `json:"date" binding:"required"`
		Settlement      float64 `json:"settlement" binding:"required"`
		Convergence     float64 `json:"convergence" binding:"required"`
		MaxDeviation    float64 `json:"max_deviation,omitempty"`
		MeanDeviation   float64 `json:"mean_deviation,omitempty"`
		CrossSectionPos float64 `json:"cross_section_pos,omitempty"`
	} `json:"history" binding:"required"`
	ForecastMonths int     `json:"forecast_months"`
	Confidence     float64 `json:"confidence"`
}

type MockForecastRequest struct {
	NumPeriods   int     `json:"num_periods"`
	StartDate    string  `json:"start_date"`
	Position     float64 `json:"position"`
	ForecastMonths int   `json:"forecast_months"`
	Confidence   float64 `json:"confidence"`
}

func (h *ForecastHandler) PostForecast(c *gin.Context) {
	var req ForecastRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "请求参数无效: " + err.Error(),
		})
		return
	}

	if len(req.History) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "历史数据不能为空",
		})
		return
	}

	forecastMonths := req.ForecastMonths
	if forecastMonths <= 0 {
		forecastMonths = 3
	}
	if forecastMonths > 12 {
		forecastMonths = 12
	}

	confidence := req.Confidence
	if confidence <= 0 {
		confidence = 0.95
	}
	if confidence > 0.999 {
		confidence = 0.999
	}

	history := make([]forecast.ForecastHistory, len(req.History))
	for i, item := range req.History {
		history[i] = forecast.ForecastHistory{
			PeriodIndex:     i + 1,
			Date:            item.Date,
			Settlement:      item.Settlement,
			Convergence:     item.Convergence,
			MaxDeviation:    item.MaxDeviation,
			MeanDeviation:   item.MeanDeviation,
			CrossSectionPos: item.CrossSectionPos,
		}
	}

	result := h.trendService.Forecast(history, forecastMonths, confidence)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    result,
	})
}

func (h *ForecastHandler) GetMockForecast(c *gin.Context) {
	numPeriods, _ := strconv.Atoi(c.DefaultQuery("num_periods", "12"))
	startDate := c.DefaultQuery("start_date", "2025-01-15")
	position, _ := strconv.ParseFloat(c.DefaultQuery("position", "0.5"), 64)
	forecastMonths, _ := strconv.Atoi(c.DefaultQuery("forecast_months", "3"))
	confidence, _ := strconv.ParseFloat(c.DefaultQuery("confidence", "0.95"), 64)

	if numPeriods < 4 {
		numPeriods = 12
	}
	if forecastMonths <= 0 {
		forecastMonths = 3
	}
	if confidence <= 0 {
		confidence = 0.95
	}

	mockHistory := h.trendService.GenerateMockHistory(numPeriods, startDate, position)
	result := h.trendService.Forecast(mockHistory, forecastMonths, confidence)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    result,
		"meta": gin.H{
			"num_periods":     numPeriods,
			"forecast_months": forecastMonths,
			"confidence":      confidence,
			"start_date":      startDate,
			"position":        position,
		},
	})
}

package api

import (
	"github.com/gin-gonic/gin"
	"pipe-monitor/internal/api/handlers"
	"pipe-monitor/internal/config"
	"pipe-monitor/internal/services/alert"
)

func SetupRoutes(r *gin.Engine, cfg *config.Config) {
	alertHub := alert.NewAlertHub()
	alertDetector := alert.NewAlertDetector(cfg, alertHub)

	bimHandler := handlers.NewBIMHandler(cfg)
	pointCloudHandler := handlers.NewPointCloudHandler(cfg)
	analysisHandler := handlers.NewAnalysisHandler(cfg, alertDetector)
	alertHandler := handlers.NewAlertHandler()
	wsHandler := handlers.NewWebSocketHandler(alertHub)
	forecastHandler := handlers.NewForecastHandler()

	api := r.Group("/api")
	{
		bim := api.Group("/bim-models")
		{
			bim.GET("", bimHandler.List)
			bim.GET("/:id", bimHandler.Get)
			bim.POST("", bimHandler.Create)
			bim.PUT("/:id", bimHandler.Update)
			bim.DELETE("/:id", bimHandler.Delete)
		}

		pc := api.Group("/point-clouds")
		{
			pc.GET("", pointCloudHandler.List)
			pc.GET("/:id", pointCloudHandler.Get)
			pc.GET("/:id/download", pointCloudHandler.Download)
			pc.POST("/upload", pointCloudHandler.Upload)
			pc.DELETE("/:id", pointCloudHandler.Delete)
		}

		analysis := api.Group("/analysis")
		{
			analysis.GET("/cross-sections", analysisHandler.ListCrossSections)
			analysis.POST("/cross-sections", analysisHandler.CreateCrossSection)
			analysis.DELETE("/cross-sections/:id", analysisHandler.DeleteCrossSection)
			analysis.POST("/cross-section", analysisHandler.AnalyzeCrossSection)
			analysis.GET("/measurements", analysisHandler.ListMeasurements)
		}

		alerts := api.Group("/alerts")
		{
			alerts.GET("", alertHandler.List)
			alerts.PUT("/:id/acknowledge", alertHandler.Acknowledge)
		}

		forecast := api.Group("/forecast")
		{
			forecast.POST("", forecastHandler.PostForecast)
			forecast.GET("/mock", forecastHandler.GetMockForecast)
		}
	}

	r.GET("/ws", func(c *gin.Context) {
		wsHandler.Handle(c.Writer, c.Request)
	})
}

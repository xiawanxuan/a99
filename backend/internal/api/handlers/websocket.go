package handlers

import (
	"pipe-monitor/internal/services/alert"
)

type WebSocketHandler struct {
	alertHub *alert.AlertHub
}

func NewWebSocketHandler(alertHub *alert.AlertHub) *WebSocketHandler {
	return &WebSocketHandler{alertHub: alertHub}
}

func (h *WebSocketHandler) Handle(c gin.ResponseWriter, r *http.Request) {
	h.alertHub.HandleWebSocket(c, r)
}

package alert

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"pipe-monitor/internal/models"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type AlertHub struct {
	clients    map[*websocket.Conn]bool
	broadcast  chan *WebSocketMessage
	register   chan *websocket.Conn
	unregister chan *websocket.Conn
	mu         sync.RWMutex
}

type WebSocketMessage struct {
	Type      string      `json:"type"`
	Payload   interface{} `json:"payload"`
	Timestamp int64       `json:"timestamp"`
}

type AlertPayload struct {
	AlertID              string  `json:"alert_id"`
	MeasurementID        string  `json:"measurement_id"`
	Level                string  `json:"level"`
	Message              string  `json:"message"`
	Threshold            float64 `json:"threshold"`
	ActualValue          float64 `json:"actual_value"`
	CrossSectionPosition float64 `json:"cross_section_position"`
	PointCloudPhase      string  `json:"point_cloud_phase"`
	CreatedAt            int64   `json:"created_at"`
}

func NewAlertHub() *AlertHub {
	hub := &AlertHub{
		clients:    make(map[*websocket.Conn]bool),
		broadcast:  make(chan *WebSocketMessage, 256),
		register:   make(chan *websocket.Conn),
		unregister: make(chan *websocket.Conn),
	}
	go hub.run()
	return hub
}

func (h *AlertHub) run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()
			log.Printf("WebSocket client connected: %v", client.RemoteAddr())

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				client.Close()
				log.Printf("WebSocket client disconnected: %v", client.RemoteAddr())
			}
			h.mu.Unlock()

		case message := <-h.broadcast:
			h.mu.RLock()
			for client := range h.clients {
				if err := client.WriteJSON(message); err != nil {
					log.Printf("WebSocket write error: %v", err)
					client.Close()
					delete(h.clients, client)
				}
			}
			h.mu.RUnlock()
		}
	}
}

func (h *AlertHub) BroadcastAlert(alert *models.Alert, crossSectionPosition float64, pointCloudPhase string) {
	payload := &AlertPayload{
		AlertID:              alert.ID.String(),
		MeasurementID:        alert.MeasurementID.String(),
		Level:                alert.Level,
		Message:              alert.Message,
		Threshold:            alert.Threshold,
		ActualValue:          alert.ActualValue,
		CrossSectionPosition: crossSectionPosition,
		PointCloudPhase:      pointCloudPhase,
		CreatedAt:            alert.CreatedAt.UnixNano() / int64(time.Millisecond),
	}

	msg := &WebSocketMessage{
		Type:      "alert",
		Payload:   payload,
		Timestamp: time.Now().UnixNano() / int64(time.Millisecond),
	}

	h.broadcast <- msg
}

func (h *AlertHub) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}

	h.register <- conn

	go h.readPump(conn)
	go h.pingPump(conn)
}

func (h *AlertHub) readPump(conn *websocket.Conn) {
	defer func() {
		h.unregister <- conn
	}()

	conn.SetReadLimit(1024)
	for {
		_, msg, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket read error: %v", err)
			}
			break
		}

		var ping map[string]interface{}
		if err := json.Unmarshal(msg, &ping); err == nil {
			if ping["type"] == "ping" {
				pong := &WebSocketMessage{
					Type:      "pong",
					Timestamp: time.Now().UnixNano() / int64(time.Millisecond),
				}
				conn.WriteJSON(pong)
			}
		}
	}
}

func (h *AlertHub) pingPump(conn *websocket.Conn) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		<-ticker.C
		if err := conn.WriteControl(websocket.PingMessage, []byte{}, time.Now().Add(10*time.Second)); err != nil {
			break
		}
	}
}

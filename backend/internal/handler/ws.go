package handler

import (
	"net/http"

	"github.com/gorilla/websocket"

	"github.com/dbbaskette/northstar/internal/service"
	"github.com/dbbaskette/northstar/internal/ws"
)

type WSHandler struct {
	hub         *ws.Hub
	authService *service.AuthService
	upgrader    websocket.Upgrader
}

func NewWSHandler(hub *ws.Hub, authService *service.AuthService) *WSHandler {
	return &WSHandler{
		hub:         hub,
		authService: authService,
		upgrader: websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
			CheckOrigin: func(r *http.Request) bool {
				return true
			},
		},
	}
}

func (h *WSHandler) Connect(w http.ResponseWriter, r *http.Request) {
	boardID := r.URL.Query().Get("board_id")
	token := r.URL.Query().Get("token")

	if boardID == "" {
		http.Error(w, "board_id is required", http.StatusBadRequest)
		return
	}
	if token == "" {
		http.Error(w, "token is required", http.StatusUnauthorized)
		return
	}

	userID, err := h.authService.ValidateAccessToken(token)
	if err != nil {
		http.Error(w, "invalid token", http.StatusUnauthorized)
		return
	}

	conn, err := h.upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}

	client := ws.NewClient(h.hub, conn, boardID, userID)
	h.hub.Register(client)

	go client.WritePump()
	go client.ReadPump()
}

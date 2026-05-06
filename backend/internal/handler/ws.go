package handler

import (
	"net/http"

	"github.com/gorilla/websocket"

	"github.com/dbbaskette/northstar/internal/repository"
	"github.com/dbbaskette/northstar/internal/service"
	"github.com/dbbaskette/northstar/internal/ws"
)

type WSHandler struct {
	hub         *ws.Hub
	authService *service.AuthService
	userRepo    *repository.UserRepo
	upgrader    websocket.Upgrader
}

func NewWSHandler(hub *ws.Hub, authService *service.AuthService, userRepo *repository.UserRepo) *WSHandler {
	return &WSHandler{
		hub:         hub,
		authService: authService,
		userRepo:    userRepo,
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

	displayName := ""
	avatarURL := ""
	if h.userRepo != nil {
		if u, err := h.userRepo.FindByID(r.Context(), userID); err == nil && u != nil {
			displayName = u.DisplayName
			if u.AvatarURL.Valid {
				avatarURL = u.AvatarURL.String
			}
		}
	}

	conn, err := h.upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}

	client := ws.NewClient(h.hub, conn, boardID, userID, displayName, avatarURL)
	h.hub.Register(client)

	go client.WritePump()
	go client.ReadPump()
}

package handler

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/dbbaskette/northstar/internal/middleware"
	"github.com/dbbaskette/northstar/internal/repository"
)

type NotificationHandler struct {
	notifRepo *repository.NotificationRepo
}

func NewNotificationHandler(notifRepo *repository.NotificationRepo) *NotificationHandler {
	return &NotificationHandler{notifRepo: notifRepo}
}

func (h *NotificationHandler) List(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	limit := 50
	if l := r.URL.Query().Get("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil {
			limit = n
		}
	}
	unreadOnly := r.URL.Query().Get("unread") == "true"

	notifs, err := h.notifRepo.ListByUser(r.Context(), userID, limit, unreadOnly)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if notifs == nil {
		notifs = []repository.Notification{}
	}
	writeJSON(w, http.StatusOK, notifs)
}

func (h *NotificationHandler) Count(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	n, err := h.notifRepo.UnreadCount(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]int{"unread": n})
}

func (h *NotificationHandler) MarkRead(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	id := chi.URLParam(r, "notificationId")
	if err := h.notifRepo.MarkRead(r.Context(), id, userID); err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "read"})
}

func (h *NotificationHandler) MarkAllRead(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	if err := h.notifRepo.MarkAllRead(r.Context(), userID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "read"})
}

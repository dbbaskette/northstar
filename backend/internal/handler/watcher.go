package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/dbbaskette/northstar/internal/middleware"
	"github.com/dbbaskette/northstar/internal/repository"
)

type WatcherHandler struct {
	watcherRepo *repository.WatcherRepo
}

func NewWatcherHandler(watcherRepo *repository.WatcherRepo) *WatcherHandler {
	return &WatcherHandler{watcherRepo: watcherRepo}
}

func (h *WatcherHandler) Watch(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	targetType := chi.URLParam(r, "targetType")
	targetID := chi.URLParam(r, "targetId")

	if err := h.watcherRepo.Watch(r.Context(), userID, targetType, targetID); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"watching": true})
}

func (h *WatcherHandler) Unwatch(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	targetType := chi.URLParam(r, "targetType")
	targetID := chi.URLParam(r, "targetId")

	if err := h.watcherRepo.Unwatch(r.Context(), userID, targetType, targetID); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"watching": false})
}

func (h *WatcherHandler) IsWatching(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	targetType := chi.URLParam(r, "targetType")
	targetID := chi.URLParam(r, "targetId")

	watching, err := h.watcherRepo.IsWatching(r.Context(), userID, targetType, targetID)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"watching": watching})
}

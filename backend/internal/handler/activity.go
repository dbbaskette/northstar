package handler

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/dbbaskette/northstar/internal/models"
	"github.com/dbbaskette/northstar/internal/repository"
)

type ActivityHandler struct {
	activityRepo *repository.ActivityRepo
}

func NewActivityHandler(activityRepo *repository.ActivityRepo) *ActivityHandler {
	return &ActivityHandler{activityRepo: activityRepo}
}

func (h *ActivityHandler) ListByBoard(w http.ResponseWriter, r *http.Request) {
	boardID := chi.URLParam(r, "boardId")

	limit := 50
	if l := r.URL.Query().Get("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil {
			limit = n
		}
	}

	activities, err := h.activityRepo.ListByBoard(r.Context(), boardID, limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if activities == nil {
		activities = []models.Activity{}
	}

	writeJSON(w, http.StatusOK, activities)
}

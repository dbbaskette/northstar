package handler

import (
	"net/http"

	"github.com/dbbaskette/northstar/internal/middleware"
	"github.com/dbbaskette/northstar/internal/repository"
)

type WorkHandler struct {
	repo *repository.WorkRepo
}

func NewWorkHandler(repo *repository.WorkRepo) *WorkHandler {
	return &WorkHandler{repo: repo}
}

func (h *WorkHandler) Mine(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	items, err := h.repo.ForUser(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"items": items})
}

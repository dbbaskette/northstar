package handler

import (
	"net/http"

	"github.com/dbbaskette/northstar/internal/middleware"
	"github.com/dbbaskette/northstar/internal/repository"
)

// MeBoards lists every board the viewer can access — across every team
// they belong to plus private boards they're explicitly on. Used by
// the command palette and "favorites" surfaces. Returns a flat list
// with team context joined in, sorted by name.
type MeBoardsHandler struct {
	repo *repository.BoardRepo
}

func NewMeBoardsHandler(repo *repository.BoardRepo) *MeBoardsHandler {
	return &MeBoardsHandler{repo: repo}
}

func (h *MeBoardsHandler) List(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	boards, err := h.repo.ListAccessibleForUser(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"boards": boards})
}

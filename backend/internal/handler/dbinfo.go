package handler

import (
	"net/http"

	"github.com/dbbaskette/northstar/internal/repository"
)

type DBInfoHandler struct {
	repo *repository.DBInfoRepo
}

func NewDBInfoHandler(repo *repository.DBInfoRepo) *DBInfoHandler {
	return &DBInfoHandler{repo: repo}
}

// Get returns a TDE / at-rest-encryption snapshot for the bound
// Postgres. Admin-gated by the route wiring in main.go.
func (h *DBInfoHandler) Get(w http.ResponseWriter, r *http.Request) {
	info, err := h.repo.Get(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, info)
}

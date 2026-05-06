package handler

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/dbbaskette/northstar/internal/middleware"
	"github.com/dbbaskette/northstar/internal/repository"
)

type ReportHandler struct {
	reportRepo *repository.ReportRepo
	boardRepo  *repository.BoardRepo
}

func NewReportHandler(reportRepo *repository.ReportRepo, boardRepo *repository.BoardRepo) *ReportHandler {
	return &ReportHandler{reportRepo: reportRepo, boardRepo: boardRepo}
}

func (h *ReportHandler) Board(w http.ResponseWriter, r *http.Request) {
	boardID := chi.URLParam(r, "boardId")
	userID := middleware.GetUserID(r.Context())

	role, err := h.boardRepo.AccessibleByUser(r.Context(), boardID, userID)
	if err != nil || role == "" {
		writeError(w, http.StatusForbidden, "no access to board")
		return
	}

	days, _ := strconv.Atoi(r.URL.Query().Get("days"))
	if days <= 0 {
		days = 30
	}
	rep, err := h.reportRepo.BoardReports(r.Context(), boardID, days)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, rep)
}

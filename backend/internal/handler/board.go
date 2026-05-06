package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/dbbaskette/northstar/internal/middleware"
	"github.com/dbbaskette/northstar/internal/models"
	"github.com/dbbaskette/northstar/internal/repository"
)

type BoardHandler struct {
	boardRepo *repository.BoardRepo
	teamRepo  *repository.TeamRepo
}

func NewBoardHandler(boardRepo *repository.BoardRepo, teamRepo *repository.TeamRepo) *BoardHandler {
	return &BoardHandler{boardRepo: boardRepo, teamRepo: teamRepo}
}

type createBoardRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Background  string `json:"background"`
}

type updateBoardRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Background  string `json:"background"`
}

func (h *BoardHandler) Create(w http.ResponseWriter, r *http.Request) {
	teamID := chi.URLParam(r, "teamId")
	userID := middleware.GetUserID(r.Context())

	if _, err := h.teamRepo.GetMemberRole(r.Context(), teamID, userID); err != nil {
		writeError(w, http.StatusForbidden, "not a team member")
		return
	}

	var req createBoardRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}
	if req.Background == "" {
		req.Background = "#0079BF"
	}

	var tid, uid pgtype.UUID
	tid.Scan(teamID)
	uid.Scan(userID)

	var desc pgtype.Text
	if req.Description != "" {
		desc = pgtype.Text{String: req.Description, Valid: true}
	}

	board := &models.Board{
		TeamID:      tid,
		Name:        req.Name,
		Description: desc,
		Background:  req.Background,
		CreatedBy:   uid,
	}

	if err := h.boardRepo.Create(r.Context(), board); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, board)
}

func (h *BoardHandler) ListByTeam(w http.ResponseWriter, r *http.Request) {
	teamID := chi.URLParam(r, "teamId")
	userID := middleware.GetUserID(r.Context())

	if _, err := h.teamRepo.GetMemberRole(r.Context(), teamID, userID); err != nil {
		writeError(w, http.StatusForbidden, "not a team member")
		return
	}

	boards, err := h.boardRepo.ListByTeam(r.Context(), teamID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if boards == nil {
		boards = []models.Board{}
	}

	writeJSON(w, http.StatusOK, boards)
}

func (h *BoardHandler) Get(w http.ResponseWriter, r *http.Request) {
	boardID := chi.URLParam(r, "boardId")

	board, err := h.boardRepo.GetFullBoard(r.Context(), boardID)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, board)
}

func (h *BoardHandler) Update(w http.ResponseWriter, r *http.Request) {
	boardID := chi.URLParam(r, "boardId")

	var req updateBoardRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := h.boardRepo.Update(r.Context(), boardID, req.Name, req.Description, req.Background); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func (h *BoardHandler) Delete(w http.ResponseWriter, r *http.Request) {
	boardID := chi.URLParam(r, "boardId")

	if err := h.boardRepo.Delete(r.Context(), boardID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

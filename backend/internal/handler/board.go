package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/dbbaskette/northstar/internal/middleware"
	"github.com/dbbaskette/northstar/internal/models"
	"github.com/dbbaskette/northstar/internal/repository"
	"github.com/dbbaskette/northstar/internal/service"
)

type BoardHandler struct {
	boardRepo *repository.BoardRepo
	teamRepo  *repository.TeamRepo
	copier    *service.BoardCopier
	audit     *repository.AuditRepo
}

func NewBoardHandler(
	boardRepo *repository.BoardRepo,
	teamRepo *repository.TeamRepo,
	copier *service.BoardCopier,
	audit *repository.AuditRepo,
) *BoardHandler {
	return &BoardHandler{boardRepo: boardRepo, teamRepo: teamRepo, copier: copier, audit: audit}
}

func (h *BoardHandler) logAudit(r *http.Request, action, targetID string, meta map[string]interface{}) {
	if h.audit == nil {
		return
	}
	_ = h.audit.Insert(r.Context(), repository.AuditInsert{
		ActorUserID: middleware.GetUserID(r.Context()),
		Action:      action,
		TargetType:  "board",
		TargetID:    targetID,
		IP:          middleware.ClientIP(r),
		UserAgent:   r.UserAgent(),
		Metadata:    meta,
	})
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

type updateVisibilityRequest struct {
	Visibility string `json:"visibility"`
}

type copyBoardRequest struct {
	Name string `json:"name"`
}

type addBoardMemberRequest struct {
	UserID string `json:"user_id"`
	Role   string `json:"role"`
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
	userID := middleware.GetUserID(r.Context())

	role, err := h.boardRepo.AccessibleByUser(r.Context(), boardID, userID)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	if role == "" {
		writeError(w, http.StatusForbidden, "you do not have access to this board")
		return
	}

	board, err := h.boardRepo.GetFullBoard(r.Context(), boardID)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, board)
}

func (h *BoardHandler) UpdateVisibility(w http.ResponseWriter, r *http.Request) {
	boardID := chi.URLParam(r, "boardId")
	userID := middleware.GetUserID(r.Context())

	role, err := h.boardRepo.AccessibleByUser(r.Context(), boardID, userID)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	if role != "owner" && role != "admin" {
		writeError(w, http.StatusForbidden, "only board admins can change visibility")
		return
	}

	var req updateVisibilityRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Visibility != "team" && req.Visibility != "private" {
		writeError(w, http.StatusBadRequest, "visibility must be 'team' or 'private'")
		return
	}

	if err := h.boardRepo.UpdateVisibility(r.Context(), boardID, req.Visibility); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// On switch to private, ensure the actor is in board_members so they
	// don't lock themselves out.
	if req.Visibility == "private" {
		if err := h.boardRepo.AddMember(r.Context(), boardID, userID, "admin"); err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
	}

	h.logAudit(r, "board.visibility_changed", boardID, map[string]interface{}{
		"visibility": req.Visibility,
	})
	writeJSON(w, http.StatusOK, map[string]string{"status": "updated", "visibility": req.Visibility})
}

func (h *BoardHandler) ListMembers(w http.ResponseWriter, r *http.Request) {
	boardID := chi.URLParam(r, "boardId")
	userID := middleware.GetUserID(r.Context())

	role, err := h.boardRepo.AccessibleByUser(r.Context(), boardID, userID)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	if role == "" {
		writeError(w, http.StatusForbidden, "no access")
		return
	}

	members, err := h.boardRepo.ListMembers(r.Context(), boardID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if members == nil {
		members = []models.BoardMember{}
	}
	writeJSON(w, http.StatusOK, members)
}

func (h *BoardHandler) AddMember(w http.ResponseWriter, r *http.Request) {
	boardID := chi.URLParam(r, "boardId")
	userID := middleware.GetUserID(r.Context())

	role, err := h.boardRepo.AccessibleByUser(r.Context(), boardID, userID)
	if err != nil || (role != "owner" && role != "admin") {
		writeError(w, http.StatusForbidden, "only board admins can add members")
		return
	}

	var req addBoardMemberRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Role == "" {
		req.Role = "member"
	}
	if !isValidUserRole(req.Role) {
		writeError(w, http.StatusBadRequest, "role must be admin, member, or viewer")
		return
	}

	if err := h.boardRepo.AddMember(r.Context(), boardID, req.UserID, req.Role); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	h.logAudit(r, "board.member_added", boardID, map[string]interface{}{
		"user_id": req.UserID, "role": req.Role,
	})
	writeJSON(w, http.StatusCreated, map[string]string{"status": "added"})
}

func (h *BoardHandler) RemoveMember(w http.ResponseWriter, r *http.Request) {
	boardID := chi.URLParam(r, "boardId")
	memberID := chi.URLParam(r, "userId")
	userID := middleware.GetUserID(r.Context())

	role, err := h.boardRepo.AccessibleByUser(r.Context(), boardID, userID)
	if err != nil || (role != "owner" && role != "admin") {
		writeError(w, http.StatusForbidden, "only board admins can remove members")
		return
	}

	if err := h.boardRepo.RemoveMember(r.Context(), boardID, memberID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	h.logAudit(r, "board.member_removed", boardID, map[string]interface{}{
		"user_id": memberID,
	})
	writeJSON(w, http.StatusOK, map[string]string{"status": "removed"})
}

func isValidUserRole(role string) bool {
	switch role {
	case "admin", "member", "viewer":
		return true
	}
	return false
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

func (h *BoardHandler) Copy(w http.ResponseWriter, r *http.Request) {
	boardID := chi.URLParam(r, "boardId")
	userID := middleware.GetUserID(r.Context())

	role, err := h.boardRepo.AccessibleByUser(r.Context(), boardID, userID)
	if err != nil || role == "" {
		writeError(w, http.StatusForbidden, "no access")
		return
	}

	var req copyBoardRequest
	json.NewDecoder(r.Body).Decode(&req) // body optional

	newID, err := h.copier.CopyBoard(r.Context(), boardID, userID, req.Name)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, map[string]string{"board_id": newID})
}

func (h *BoardHandler) Delete(w http.ResponseWriter, r *http.Request) {
	boardID := chi.URLParam(r, "boardId")

	if err := h.boardRepo.Delete(r.Context(), boardID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.logAudit(r, "board.deleted", boardID, nil)
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

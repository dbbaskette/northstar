package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/dbbaskette/northstar/internal/middleware"
	"github.com/dbbaskette/northstar/internal/repository"
)

type InviteHandler struct {
	inviteRepo *repository.InviteRepo
	boardRepo  *repository.BoardRepo
	teamRepo   *repository.TeamRepo
}

func NewInviteHandler(
	inviteRepo *repository.InviteRepo,
	boardRepo *repository.BoardRepo,
	teamRepo *repository.TeamRepo,
) *InviteHandler {
	return &InviteHandler{
		inviteRepo: inviteRepo,
		boardRepo:  boardRepo,
		teamRepo:   teamRepo,
	}
}

type createInviteRequest struct {
	Email         string `json:"email"`
	Role          string `json:"role"`
	ExpiresInDays int    `json:"expires_in_days"`
}

func (h *InviteHandler) Create(w http.ResponseWriter, r *http.Request) {
	boardID := chi.URLParam(r, "boardId")
	userID := middleware.GetUserID(r.Context())

	role, err := h.boardRepo.AccessibleByUser(r.Context(), boardID, userID)
	if err != nil || (role != "owner" && role != "admin") {
		writeError(w, http.StatusForbidden, "only board admins can create invites")
		return
	}

	var req createInviteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Role == "" {
		req.Role = "member"
	}
	if req.Role != "admin" && req.Role != "member" && req.Role != "viewer" {
		writeError(w, http.StatusBadRequest, "role must be admin, member, or viewer")
		return
	}

	invite, err := h.inviteRepo.Create(r.Context(), boardID, userID, req.Email, req.Role, req.ExpiresInDays)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, invite)
}

func (h *InviteHandler) List(w http.ResponseWriter, r *http.Request) {
	boardID := chi.URLParam(r, "boardId")
	userID := middleware.GetUserID(r.Context())

	role, err := h.boardRepo.AccessibleByUser(r.Context(), boardID, userID)
	if err != nil || (role != "owner" && role != "admin") {
		writeError(w, http.StatusForbidden, "only board admins can view invites")
		return
	}

	invites, err := h.inviteRepo.ListByBoard(r.Context(), boardID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if invites == nil {
		invites = []repository.Invite{}
	}
	writeJSON(w, http.StatusOK, invites)
}

func (h *InviteHandler) Delete(w http.ResponseWriter, r *http.Request) {
	inviteID := chi.URLParam(r, "inviteId")

	if err := h.inviteRepo.Delete(r.Context(), inviteID); err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// Preview returns invite details without requiring auth, so the accept
// page can show the recipient what they're joining before signing in.
func (h *InviteHandler) Preview(w http.ResponseWriter, r *http.Request) {
	token := chi.URLParam(r, "token")

	inv, err := h.inviteRepo.FindByToken(r.Context(), token)
	if err != nil {
		writeError(w, http.StatusNotFound, "invite not found")
		return
	}

	if inv.AcceptedAt.Valid {
		writeError(w, http.StatusGone, "invite already accepted")
		return
	}
	if inv.ExpiresAt.Valid && time.Now().After(inv.ExpiresAt.Time) {
		writeError(w, http.StatusGone, "invite has expired")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"board_id":     uuidStr(inv.BoardID),
		"board_name":   inv.BoardName,
		"team_name":    inv.TeamName,
		"inviter_name": inv.InviterName,
		"role":         inv.Role,
	})
}

// Accept joins the authenticated user to the board.
func (h *InviteHandler) Accept(w http.ResponseWriter, r *http.Request) {
	token := chi.URLParam(r, "token")
	userID := middleware.GetUserID(r.Context())

	inv, err := h.inviteRepo.FindByToken(r.Context(), token)
	if err != nil {
		writeError(w, http.StatusNotFound, "invite not found")
		return
	}
	if inv.AcceptedAt.Valid {
		writeError(w, http.StatusGone, "invite already accepted")
		return
	}
	if inv.ExpiresAt.Valid && time.Now().After(inv.ExpiresAt.Time) {
		writeError(w, http.StatusGone, "invite has expired")
		return
	}

	boardID := uuidStr(inv.BoardID)
	board, err := h.boardRepo.FindByID(r.Context(), boardID)
	if err != nil {
		writeError(w, http.StatusNotFound, "board not found")
		return
	}

	// Ensure the user can see the board:
	//  - For 'team' visibility: add to team_members
	//  - For 'private' visibility: add to board_members
	if board.Visibility == "private" {
		if err := h.boardRepo.AddMember(r.Context(), boardID, userID, inv.Role); err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
	} else {
		teamRole := "member"
		if inv.Role == "viewer" {
			teamRole = "viewer"
		}
		if err := h.teamRepo.AddMember(r.Context(), uuidStr(board.TeamID), userID, teamRole); err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
	}

	if err := h.inviteRepo.MarkAccepted(r.Context(), uuidStr(inv.ID), userID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"status":   "accepted",
		"board_id": boardID,
	})
}

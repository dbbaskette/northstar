package handler

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/dbbaskette/northstar/internal/middleware"
	"github.com/dbbaskette/northstar/internal/models"
	"github.com/dbbaskette/northstar/internal/repository"
)

type TeamHandler struct {
	teamRepo *repository.TeamRepo
	audit    *repository.AuditRepo
}

func NewTeamHandler(teamRepo *repository.TeamRepo, audit *repository.AuditRepo) *TeamHandler {
	return &TeamHandler{teamRepo: teamRepo, audit: audit}
}

func (h *TeamHandler) logAudit(r *http.Request, action, targetType, targetID string, meta map[string]interface{}) {
	if h.audit == nil {
		return
	}
	_ = h.audit.Insert(r.Context(), repository.AuditInsert{
		ActorUserID: middleware.GetUserID(r.Context()),
		Action:      action,
		TargetType:  targetType,
		TargetID:    targetID,
		IP:          middleware.ClientIP(r),
		UserAgent:   r.UserAgent(),
		Metadata:    meta,
	})
}

type createTeamRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

type addMemberRequest struct {
	UserID string `json:"user_id"`
	Role   string `json:"role"`
}

type updateMemberRequest struct {
	Role string `json:"role"`
}

func (h *TeamHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req createTeamRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}

	userID := middleware.GetUserID(r.Context())
	var createdBy pgtype.UUID
	if err := createdBy.Scan(userID); err != nil {
		writeError(w, http.StatusInternalServerError, "invalid user id")
		return
	}

	var desc pgtype.Text
	if req.Description != "" {
		desc = pgtype.Text{String: req.Description, Valid: true}
	}

	team := &models.Team{
		Name:        req.Name,
		Description: desc,
		CreatedBy:   createdBy,
	}

	if err := h.teamRepo.Create(r.Context(), team); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if err := h.teamRepo.AddMember(r.Context(), uuidStr(team.ID), userID, "owner"); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, team)
}

func (h *TeamHandler) List(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	teams, err := h.teamRepo.ListByUser(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if teams == nil {
		teams = []models.Team{}
	}
	writeJSON(w, http.StatusOK, teams)
}

func (h *TeamHandler) Get(w http.ResponseWriter, r *http.Request) {
	teamID := chi.URLParam(r, "teamId")
	userID := middleware.GetUserID(r.Context())

	if _, err := h.teamRepo.GetMemberRole(r.Context(), teamID, userID); err != nil {
		writeError(w, http.StatusForbidden, "not a team member")
		return
	}

	team, err := h.teamRepo.FindByID(r.Context(), teamID)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	members, err := h.teamRepo.GetMembers(r.Context(), teamID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"team":    team,
		"members": members,
	})
}

func (h *TeamHandler) Update(w http.ResponseWriter, r *http.Request) {
	teamID := chi.URLParam(r, "teamId")
	userID := middleware.GetUserID(r.Context())

	role, err := h.teamRepo.GetMemberRole(r.Context(), teamID, userID)
	if err != nil || (role != "owner" && role != "admin") {
		writeError(w, http.StatusForbidden, "insufficient permissions")
		return
	}

	var req createTeamRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := h.teamRepo.Update(r.Context(), teamID, req.Name, req.Description); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func (h *TeamHandler) Delete(w http.ResponseWriter, r *http.Request) {
	teamID := chi.URLParam(r, "teamId")
	userID := middleware.GetUserID(r.Context())

	role, err := h.teamRepo.GetMemberRole(r.Context(), teamID, userID)
	if err != nil || role != "owner" {
		writeError(w, http.StatusForbidden, "only the owner can delete a team")
		return
	}

	if err := h.teamRepo.Delete(r.Context(), teamID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.logAudit(r, "team.deleted", "team", teamID, nil)
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

func (h *TeamHandler) AddMember(w http.ResponseWriter, r *http.Request) {
	teamID := chi.URLParam(r, "teamId")
	userID := middleware.GetUserID(r.Context())

	role, err := h.teamRepo.GetMemberRole(r.Context(), teamID, userID)
	if err != nil || (role != "owner" && role != "admin") {
		writeError(w, http.StatusForbidden, "insufficient permissions")
		return
	}

	var req addMemberRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Role == "" {
		req.Role = "member"
	}

	if err := h.teamRepo.AddMember(r.Context(), teamID, req.UserID, req.Role); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.logAudit(r, "team.member_added", "team", teamID, map[string]interface{}{
		"user_id": req.UserID, "role": req.Role,
	})
	writeJSON(w, http.StatusCreated, map[string]string{"status": "member added"})
}

func (h *TeamHandler) RemoveMember(w http.ResponseWriter, r *http.Request) {
	teamID := chi.URLParam(r, "teamId")
	memberID := chi.URLParam(r, "userId")
	userID := middleware.GetUserID(r.Context())

	role, err := h.teamRepo.GetMemberRole(r.Context(), teamID, userID)
	if err != nil || (role != "owner" && role != "admin") {
		writeError(w, http.StatusForbidden, "insufficient permissions")
		return
	}

	if err := h.teamRepo.RemoveMember(r.Context(), teamID, memberID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.logAudit(r, "team.member_removed", "team", teamID, map[string]interface{}{
		"user_id": memberID,
	})
	writeJSON(w, http.StatusOK, map[string]string{"status": "member removed"})
}

func (h *TeamHandler) UpdateMember(w http.ResponseWriter, r *http.Request) {
	teamID := chi.URLParam(r, "teamId")
	memberID := chi.URLParam(r, "userId")
	userID := middleware.GetUserID(r.Context())

	role, err := h.teamRepo.GetMemberRole(r.Context(), teamID, userID)
	if err != nil || (role != "owner" && role != "admin") {
		writeError(w, http.StatusForbidden, "insufficient permissions")
		return
	}

	var req updateMemberRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := h.teamRepo.AddMember(r.Context(), teamID, memberID, req.Role); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.logAudit(r, "team.role_changed", "team", teamID, map[string]interface{}{
		"user_id": memberID, "new_role": req.Role,
	})
	writeJSON(w, http.StatusOK, map[string]string{"status": "role updated"})
}

func uuidStr(id pgtype.UUID) string {
	if !id.Valid {
		return ""
	}
	b := id.Bytes
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

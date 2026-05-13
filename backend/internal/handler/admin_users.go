package handler

import (
	"crypto/rand"
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"golang.org/x/crypto/bcrypt"

	"github.com/dbbaskette/northstar/internal/middleware"
	"github.com/dbbaskette/northstar/internal/models"
	"github.com/dbbaskette/northstar/internal/repository"
)

type AdminUserHandler struct {
	userRepo *repository.UserRepo
	audit    *repository.AuditRepo
}

func NewAdminUserHandler(userRepo *repository.UserRepo, audit *repository.AuditRepo) *AdminUserHandler {
	return &AdminUserHandler{userRepo: userRepo, audit: audit}
}

func (h *AdminUserHandler) audited(r *http.Request, action, targetID string, meta map[string]interface{}) {
	if h.audit == nil {
		return
	}
	_ = h.audit.Insert(r.Context(), repository.AuditInsert{
		ActorUserID: middleware.GetUserID(r.Context()),
		Action:      action,
		TargetType:  "user",
		TargetID:    targetID,
		IP:          middleware.ClientIP(r),
		UserAgent:   r.UserAgent(),
		Metadata:    meta,
	})
}

func (h *AdminUserHandler) List(w http.ResponseWriter, r *http.Request) {
	users, err := h.userRepo.AdminList(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"users": users})
}

type updateUserRequest struct {
	Role     *string `json:"role,omitempty"`
	IsActive *bool   `json:"is_active,omitempty"`
}

func (h *AdminUserHandler) Update(w http.ResponseWriter, r *http.Request) {
	userID := chi.URLParam(r, "userId")
	var req updateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	if req.Role != nil {
		if err := h.userRepo.SetRole(r.Context(), userID, *req.Role); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		h.audited(r, "user.role_changed", userID, map[string]interface{}{"new_role": *req.Role})
	}
	if req.IsActive != nil {
		if err := h.userRepo.SetActive(r.Context(), userID, *req.IsActive); err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		if !*req.IsActive {
			_ = h.userRepo.RevokeRefreshTokens(r.Context(), userID)
			h.audited(r, "user.deactivated", userID, nil)
		} else {
			h.audited(r, "user.reactivated", userID, nil)
		}
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

type bulkRoleRequest struct {
	UserIDs []string `json:"user_ids"`
	Role    string   `json:"role"`
}

func (h *AdminUserHandler) BulkRole(w http.ResponseWriter, r *http.Request) {
	var req bulkRoleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || len(req.UserIDs) == 0 || req.Role == "" {
		writeError(w, http.StatusBadRequest, "user_ids and role are required")
		return
	}
	for _, id := range req.UserIDs {
		if err := h.userRepo.SetRole(r.Context(), id, req.Role); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		h.audited(r, "user.role_changed", id, map[string]interface{}{"new_role": req.Role, "via": "bulk"})
	}
	writeJSON(w, http.StatusOK, map[string]int{"updated": len(req.UserIDs)})
}

func (h *AdminUserHandler) RevokeSessions(w http.ResponseWriter, r *http.Request) {
	userID := chi.URLParam(r, "userId")
	if err := h.userRepo.RevokeRefreshTokens(r.Context(), userID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	h.audited(r, "user.sessions_revoked", userID, nil)
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

type createUserRequest struct {
	Email       string `json:"email"`
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
	Role        string `json:"role"`
}

// Create provisions a new account with a random 14-char temp
// password. The plaintext password is included in the response ONCE
// — admin copies it, hands it to the user out-of-band, and the
// must_change_password flag on the user record forces them through a
// change-password screen on first login.
func (h *AdminUserHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req createUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	if req.Email == "" || req.Username == "" || req.DisplayName == "" {
		writeError(w, http.StatusBadRequest, "email, username, display_name are required")
		return
	}
	role := req.Role
	if role == "" {
		role = "member"
	}
	switch role {
	case "admin", "member", "viewer":
	default:
		writeError(w, http.StatusBadRequest, "role must be admin, member, or viewer")
		return
	}

	tempPassword, err := generateTempPassword(14)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(tempPassword), bcrypt.DefaultCost)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	u := &models.User{
		Email:        req.Email,
		Username:     req.Username,
		DisplayName:  req.DisplayName,
		Role:         role,
		PasswordHash: string(hash),
	}
	if err := h.userRepo.CreateAdminInvited(r.Context(), u); err != nil {
		writeError(w, http.StatusConflict, err.Error())
		return
	}

	h.audited(r, "user.created", uuidStr(u.ID), map[string]interface{}{
		"email": u.Email, "role": role, "via": "admin_invite",
	})

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"user":          u,
		"temp_password": tempPassword,
		"warning":       "This password is only shown once — copy it before closing.",
	})
}

// generateTempPassword returns a random URL-safe password. Mixed
// alphanum so it's easy to read aloud / paste without escaping.
func generateTempPassword(n int) (string, error) {
	// 64 chars, ambiguous ones (0/O, 1/l/I) dropped so admins can
	// read passwords over Slack without "is that a one or an L".
	const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	for i := range b {
		b[i] = alphabet[int(b[i])%len(alphabet)]
	}
	return string(b), nil
}

func (h *AdminUserHandler) Approve(w http.ResponseWriter, r *http.Request) {
	userID := chi.URLParam(r, "userId")
	if err := h.userRepo.Approve(r.Context(), userID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	h.audited(r, "user.approved", userID, nil)
	writeJSON(w, http.StatusOK, map[string]string{"status": "approved"})
}

// Delete removes the user permanently. Cascades through every FK
// that references users.id ON DELETE CASCADE/SET NULL. The acting
// admin can't delete themselves — they have to switch admins first.
func (h *AdminUserHandler) Delete(w http.ResponseWriter, r *http.Request) {
	userID := chi.URLParam(r, "userId")
	actorID := middleware.GetUserID(r.Context())
	if userID == actorID {
		writeError(w, http.StatusBadRequest, "you cannot delete your own account")
		return
	}
	if err := h.userRepo.HardDelete(r.Context(), userID); err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	h.audited(r, "user.deleted", userID, nil)
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

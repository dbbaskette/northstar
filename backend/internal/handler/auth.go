package handler

import (
	"encoding/json"
	"net/http"

	"github.com/dbbaskette/northstar/internal/middleware"
	"github.com/dbbaskette/northstar/internal/repository"
	"github.com/dbbaskette/northstar/internal/service"
)

type AuthHandler struct {
	authService *service.AuthService
	audit       *repository.AuditRepo
}

func NewAuthHandler(authService *service.AuthService, audit *repository.AuditRepo) *AuthHandler {
	return &AuthHandler{authService: authService, audit: audit}
}

func (h *AuthHandler) logAudit(r *http.Request, userID, action string, meta map[string]interface{}) {
	if h.audit == nil {
		return
	}
	_ = h.audit.Insert(r.Context(), repository.AuditInsert{
		ActorUserID: userID,
		Action:      action,
		IP:          middleware.ClientIP(r),
		UserAgent:   r.UserAgent(),
		Metadata:    meta,
	})
}

type registerRequest struct {
	Email       string `json:"email"`
	Username    string `json:"username"`
	Password    string `json:"password"`
	DisplayName string `json:"display_name"`
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	TOTPCode string `json:"totp_code,omitempty"`
}

type refreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req registerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Email == "" || req.Username == "" || req.Password == "" || req.DisplayName == "" {
		writeError(w, http.StatusBadRequest, "all fields are required")
		return
	}

	if len(req.Password) < 8 {
		writeError(w, http.StatusBadRequest, "password must be at least 8 characters")
		return
	}

	user, tokens, err := h.authService.Register(r.Context(), req.Email, req.Username, req.Password, req.DisplayName)
	if err != nil {
		h.logAudit(r, "", "auth.register_failed", map[string]interface{}{"email": req.Email, "error": err.Error()})
		writeError(w, http.StatusConflict, err.Error())
		return
	}

	h.logAudit(r, uuidStr(user.ID), "auth.register", map[string]interface{}{"email": user.Email})
	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"user":          user,
		"access_token":  tokens.AccessToken,
		"refresh_token": tokens.RefreshToken,
	})
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Email == "" || req.Password == "" {
		writeError(w, http.StatusBadRequest, "email and password are required")
		return
	}

	user, tokens, err := h.authService.Login(r.Context(), service.LoginInput{
		Email:     req.Email,
		Password:  req.Password,
		TOTPCode:  req.TOTPCode,
		IP:        middleware.ClientIP(r),
		UserAgent: r.UserAgent(),
	})
	if err != nil {
		if err == service.ErrTwoFARequired {
			writeJSON(w, http.StatusOK, map[string]interface{}{"two_factor_required": true})
			return
		}
		h.logAudit(r, "", "auth.login_failed", map[string]interface{}{"email": req.Email})
		writeError(w, http.StatusUnauthorized, "invalid credentials")
		return
	}

	h.logAudit(r, uuidStr(user.ID), "auth.login", map[string]interface{}{"email": user.Email})
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"user":          user,
		"access_token":  tokens.AccessToken,
		"refresh_token": tokens.RefreshToken,
	})
}

func (h *AuthHandler) Refresh(w http.ResponseWriter, r *http.Request) {
	var req refreshRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.RefreshToken == "" {
		writeError(w, http.StatusBadRequest, "refresh_token is required")
		return
	}

	accessToken, err := h.authService.Refresh(r.Context(), req.RefreshToken)
	if err != nil {
		writeError(w, http.StatusUnauthorized, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"access_token": accessToken,
	})
}

func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	if userID == "" {
		writeError(w, http.StatusUnauthorized, "not authenticated")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"user_id": userID,
	})
}

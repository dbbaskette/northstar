package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/golang-jwt/jwt/v5"
	"github.com/pquerna/otp/totp"

	"github.com/dbbaskette/northstar/internal/middleware"
	"github.com/dbbaskette/northstar/internal/repository"
)

type SecurityHandler struct {
	sessions  *repository.SessionRepo
	twofa     *repository.TwoFARepo
	userRepo  *repository.UserRepo
	jwtSecret []byte
}

func NewSecurityHandler(
	sessions *repository.SessionRepo,
	twofa *repository.TwoFARepo,
	userRepo *repository.UserRepo,
	jwtSecret string,
) *SecurityHandler {
	return &SecurityHandler{
		sessions:  sessions,
		twofa:     twofa,
		userRepo:  userRepo,
		jwtSecret: []byte(jwtSecret),
	}
}

// jtiFromAuthHeader peeks at the unverified JWT to surface a "this is
// you" hint on the sessions list. It's verified-elsewhere data — we
// only read it for the UI marker, never to grant trust.
func (h *SecurityHandler) jtiFromAuthHeader(r *http.Request) string {
	auth := r.Header.Get("Authorization")
	if len(auth) < 8 {
		return ""
	}
	tok := auth[7:]
	parsed, _, err := jwt.NewParser().ParseUnverified(tok, jwt.MapClaims{})
	if err != nil {
		return ""
	}
	if claims, ok := parsed.Claims.(jwt.MapClaims); ok {
		if jti, ok := claims["jti"].(string); ok {
			return jti
		}
	}
	return ""
}

func (h *SecurityHandler) ListSessions(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	sessions, err := h.sessions.ListForUser(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	current := h.jtiFromAuthHeader(r)
	for i := range sessions {
		if sessions[i].JTI == current {
			sessions[i].IsCurrent = true
		}
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"sessions": sessions})
}

func (h *SecurityHandler) RevokeSession(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	id := chi.URLParam(r, "sessionId")
	if err := h.sessions.Revoke(r.Context(), id, userID); err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "revoked"})
}

// TwoFAStatus reports whether the viewer has 2FA configured.
func (h *SecurityHandler) TwoFAStatus(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	row, _ := h.twofa.Get(r.Context(), userID)
	enabled := row != nil && row.EnabledAt != nil
	writeJSON(w, http.StatusOK, map[string]bool{"enabled": enabled})
}

// TwoFASetup creates (or replaces) a pending TOTP secret and returns
// the otpauth:// URI so the SPA can render a QR code. The secret is
// not active until /verify succeeds.
func (h *SecurityHandler) TwoFASetup(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	user, err := h.userRepo.FindByID(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusNotFound, "user not found")
		return
	}
	key, err := totp.Generate(totp.GenerateOpts{
		Issuer:      "Northstar",
		AccountName: user.Email,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if err := h.twofa.SaveSecret(r.Context(), userID, key.Secret()); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{
		"otpauth_url": key.URL(),
		"secret":      key.Secret(),
	})
}

type twofaVerifyRequest struct {
	Code string `json:"code"`
}

func (h *SecurityHandler) TwoFAVerify(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	var req twofaVerifyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Code == "" {
		writeError(w, http.StatusBadRequest, "code is required")
		return
	}
	row, err := h.twofa.Get(r.Context(), userID)
	if err != nil || row == nil {
		writeError(w, http.StatusBadRequest, "no setup in progress")
		return
	}
	if !totp.Validate(req.Code, row.TOTPSecret) {
		writeError(w, http.StatusUnauthorized, "invalid code")
		return
	}
	if err := h.twofa.Enable(r.Context(), userID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "enabled"})
}

func (h *SecurityHandler) TwoFADisable(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	if err := h.twofa.Disable(r.Context(), userID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "disabled"})
}

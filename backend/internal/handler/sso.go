package handler

import (
	"net/http"
	"net/url"

	"github.com/dbbaskette/northstar/internal/middleware"
	"github.com/dbbaskette/northstar/internal/repository"
	"github.com/dbbaskette/northstar/internal/service"
)

type SSOHandler struct {
	github *service.GitHubOAuth
	audit  *repository.AuditRepo
}

func NewSSOHandler(github *service.GitHubOAuth, audit *repository.AuditRepo) *SSOHandler {
	return &SSOHandler{github: github, audit: audit}
}

// Providers tells the frontend which sign-in buttons to render.
func (h *SSOHandler) Providers(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"github": h.github.IsEnabled(),
	})
}

// GitHubStart redirects the browser to github.com to begin the OAuth dance.
// Optional `return_to` query param controls where the user lands after
// the callback (defaults to /dashboard).
func (h *SSOHandler) GitHubStart(w http.ResponseWriter, r *http.Request) {
	if !h.github.IsEnabled() {
		writeError(w, http.StatusServiceUnavailable, "github sign-in is not configured")
		return
	}
	returnTo := r.URL.Query().Get("return_to")
	if returnTo == "" {
		returnTo = "/dashboard"
	}
	authURL, err := h.github.AuthorizeURL(returnTo)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	http.Redirect(w, r, authURL, http.StatusFound)
}

// GitHubCallback consumes the redirect from github.com, exchanges the
// code, resolves/creates a user, and bounces back to the SPA with the
// access + refresh tokens in the URL fragment.
func (h *SSOHandler) GitHubCallback(w http.ResponseWriter, r *http.Request) {
	if !h.github.IsEnabled() {
		writeError(w, http.StatusServiceUnavailable, "github sign-in is not configured")
		return
	}
	q := r.URL.Query()
	if errStr := q.Get("error"); errStr != "" {
		http.Redirect(w, r, "/login?error="+url.QueryEscape(errStr), http.StatusFound)
		return
	}
	code := q.Get("code")
	state := q.Get("state")
	if code == "" || state == "" {
		http.Redirect(w, r, "/login?error=missing_params", http.StatusFound)
		return
	}

	user, tokens, returnTo, err := h.github.HandleCallback(r.Context(), code, state)
	if err != nil {
		if h.audit != nil {
			_ = h.audit.Insert(r.Context(), repository.AuditInsert{
				Action:    "auth.sso_failed",
				IP:        middleware.ClientIP(r),
				UserAgent: r.UserAgent(),
				Metadata:  map[string]interface{}{"provider": "github", "error": err.Error()},
			})
		}
		http.Redirect(w, r, "/login?error="+url.QueryEscape(err.Error()), http.StatusFound)
		return
	}

	if h.audit != nil {
		_ = h.audit.Insert(r.Context(), repository.AuditInsert{
			ActorUserID: uuidStr(user.ID),
			Action:      "auth.sso_login",
			IP:          middleware.ClientIP(r),
			UserAgent:   r.UserAgent(),
			Metadata:    map[string]interface{}{"provider": "github", "email": user.Email},
		})
	}

	// Tokens go in the fragment so they don't end up in proxy/server
	// access logs. The SPA reads them client-side and stashes them in
	// localStorage, then router-replaces to returnTo.
	target := "/login#access_token=" + url.QueryEscape(tokens.AccessToken) +
		"&refresh_token=" + url.QueryEscape(tokens.RefreshToken) +
		"&return_to=" + url.QueryEscape(returnTo)
	http.Redirect(w, r, target, http.StatusFound)
}

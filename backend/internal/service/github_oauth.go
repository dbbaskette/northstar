package service

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/dbbaskette/northstar/internal/models"
	"github.com/dbbaskette/northstar/internal/repository"
)

// GitHubOAuth handles the "Sign in with GitHub" flow.
//
// Configuration is via env vars (GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET,
// BASE_URL). When client id+secret are absent, IsEnabled() returns false
// and the handlers respond with 503 — the frontend hides the button.
type GitHubOAuth struct {
	clientID     string
	clientSecret string
	baseURL      string
	stateSecret  []byte

	userRepo *repository.UserRepo
	auth     *AuthService
	http     *http.Client
}

func NewGitHubOAuth(
	clientID, clientSecret, baseURL, stateSecret string,
	userRepo *repository.UserRepo,
	auth *AuthService,
) *GitHubOAuth {
	return &GitHubOAuth{
		clientID:     clientID,
		clientSecret: clientSecret,
		baseURL:      strings.TrimRight(baseURL, "/"),
		stateSecret:  []byte(stateSecret),
		userRepo:     userRepo,
		auth:         auth,
		http:         &http.Client{Timeout: 10 * time.Second},
	}
}

func (g *GitHubOAuth) IsEnabled() bool {
	return g != nil && g.clientID != "" && g.clientSecret != ""
}

// AuthorizeURL returns the URL the browser should be redirected to.
// The opaque `state` is HMAC-signed so the callback can verify it
// originated from us without storing per-flow server state.
func (g *GitHubOAuth) AuthorizeURL(returnTo string) (string, error) {
	state, err := g.signState(returnTo)
	if err != nil {
		return "", err
	}
	q := url.Values{}
	q.Set("client_id", g.clientID)
	q.Set("redirect_uri", g.callbackURL())
	q.Set("scope", "read:user user:email")
	q.Set("state", state)
	return "https://github.com/login/oauth/authorize?" + q.Encode(), nil
}

func (g *GitHubOAuth) callbackURL() string {
	if g.baseURL == "" {
		// Best-effort default for dev — the user will set BASE_URL in
		// production, but this lets local testing work.
		return "http://localhost:8180/api/v1/auth/github/callback"
	}
	return g.baseURL + "/api/v1/auth/github/callback"
}

// HandleCallback exchanges the code for tokens, fetches the GitHub
// profile + primary email, then resolves the user (link by email,
// create if none).
//
// Returns the resolved user and a Northstar token pair. The caller is
// responsible for relaying the tokens to the browser.
func (g *GitHubOAuth) HandleCallback(
	ctx context.Context,
	code, state string,
) (*models.User, *TokenPair, string, error) {
	returnTo, ok := g.verifyState(state)
	if !ok {
		return nil, nil, "", fmt.Errorf("invalid state")
	}

	accessToken, err := g.exchangeCode(ctx, code)
	if err != nil {
		return nil, nil, "", fmt.Errorf("token exchange: %w", err)
	}

	profile, err := g.fetchProfile(ctx, accessToken)
	if err != nil {
		return nil, nil, "", err
	}

	user, err := g.resolveUser(ctx, profile)
	if err != nil {
		return nil, nil, "", err
	}

	if active, err := g.userRepo.IsActive(ctx, uuidString(user.ID)); err != nil || !active {
		return nil, nil, "", fmt.Errorf("account is deactivated")
	}

	tokens, err := g.auth.GenerateTokens(ctx, user)
	if err != nil {
		return nil, nil, "", err
	}
	return user, tokens, returnTo, nil
}

type ghTokenResponse struct {
	AccessToken string `json:"access_token"`
	Error       string `json:"error"`
}

func (g *GitHubOAuth) exchangeCode(ctx context.Context, code string) (string, error) {
	body := url.Values{}
	body.Set("client_id", g.clientID)
	body.Set("client_secret", g.clientSecret)
	body.Set("code", code)
	body.Set("redirect_uri", g.callbackURL())

	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		"https://github.com/login/oauth/access_token", strings.NewReader(body.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := g.http.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
	var t ghTokenResponse
	if err := json.Unmarshal(raw, &t); err != nil {
		return "", fmt.Errorf("decode token response: %w", err)
	}
	if t.AccessToken == "" {
		if t.Error != "" {
			return "", fmt.Errorf("github: %s", t.Error)
		}
		return "", fmt.Errorf("github: empty access token")
	}
	return t.AccessToken, nil
}

type ghUserResponse struct {
	ID        int64  `json:"id"`
	Login     string `json:"login"`
	Name      string `json:"name"`
	AvatarURL string `json:"avatar_url"`
	Email     string `json:"email"`
}

type ghEmail struct {
	Email    string `json:"email"`
	Primary  bool   `json:"primary"`
	Verified bool   `json:"verified"`
}

type GitHubProfile struct {
	ID          string
	Login       string
	DisplayName string
	Email       string
	AvatarURL   string
}

func (g *GitHubOAuth) fetchProfile(ctx context.Context, token string) (*GitHubProfile, error) {
	user, err := g.fetchJSON(ctx, "https://api.github.com/user", token)
	if err != nil {
		return nil, err
	}
	var u ghUserResponse
	if err := json.Unmarshal(user, &u); err != nil {
		return nil, err
	}

	email := u.Email
	if email == "" {
		emails, err := g.fetchJSON(ctx, "https://api.github.com/user/emails", token)
		if err == nil {
			var list []ghEmail
			if err := json.Unmarshal(emails, &list); err == nil {
				for _, e := range list {
					if e.Primary && e.Verified {
						email = e.Email
						break
					}
				}
				// Fall back to any verified address.
				if email == "" {
					for _, e := range list {
						if e.Verified {
							email = e.Email
							break
						}
					}
				}
			}
		}
	}
	if email == "" {
		return nil, fmt.Errorf("no verified email available from GitHub")
	}

	displayName := u.Name
	if displayName == "" {
		displayName = u.Login
	}

	return &GitHubProfile{
		ID:          fmt.Sprintf("%d", u.ID),
		Login:       u.Login,
		DisplayName: displayName,
		Email:       email,
		AvatarURL:   u.AvatarURL,
	}, nil
}

func (g *GitHubOAuth) fetchJSON(ctx context.Context, url, token string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")
	resp, err := g.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("github GET %s: status %d", url, resp.StatusCode)
	}
	return io.ReadAll(io.LimitReader(resp.Body, 32*1024))
}

func (g *GitHubOAuth) resolveUser(ctx context.Context, p *GitHubProfile) (*models.User, error) {
	// 1. Already linked? Use that account directly.
	if u, err := g.userRepo.FindByExternalID(ctx, "github", p.ID); err == nil {
		return u, nil
	}

	// 2. Existing local user with the same email — link the SSO id.
	if u, err := g.userRepo.FindByEmail(ctx, p.Email); err == nil {
		if err := g.userRepo.LinkExternalID(ctx, uuidString(u.ID), "github", p.ID); err != nil {
			return nil, err
		}
		return u, nil
	}

	// 3. New user — provision with the default member role. Username
	//    must be unique; lean on the GitHub login but fall back to
	//    something email-derived if it collides.
	username := p.Login
	if username == "" {
		username = strings.SplitN(p.Email, "@", 2)[0]
	}

	u := &models.User{
		Email:       p.Email,
		Username:    username,
		DisplayName: p.DisplayName,
		Role:        "member",
	}
	if err := g.userRepo.CreateExternalUser(ctx, u, "github", p.ID); err != nil {
		// Likely a username collision; retry once with a numeric suffix.
		u.Username = username + "-gh"
		if err2 := g.userRepo.CreateExternalUser(ctx, u, "github", p.ID); err2 != nil {
			return nil, fmt.Errorf("create user: %w", err)
		}
	}
	return u, nil
}

// State signing — `<returnTo>:<nonce>:<hmac>`. nonce makes replay across
// concurrent flows safe; hmac proves we minted it.
func (g *GitHubOAuth) signState(returnTo string) (string, error) {
	nonce := make([]byte, 16)
	if _, err := rand.Read(nonce); err != nil {
		return "", err
	}
	body := returnTo + "|" + hex.EncodeToString(nonce)
	mac := hmac.New(sha256.New, g.stateSecret)
	mac.Write([]byte(body))
	sig := hex.EncodeToString(mac.Sum(nil))
	return base64.RawURLEncoding.EncodeToString([]byte(body + "|" + sig)), nil
}

func (g *GitHubOAuth) verifyState(s string) (string, bool) {
	raw, err := base64.RawURLEncoding.DecodeString(s)
	if err != nil {
		return "", false
	}
	parts := strings.Split(string(raw), "|")
	if len(parts) != 3 {
		return "", false
	}
	expected := hmac.New(sha256.New, g.stateSecret)
	expected.Write([]byte(parts[0] + "|" + parts[1]))
	expectedSig := hex.EncodeToString(expected.Sum(nil))
	if !hmac.Equal([]byte(expectedSig), []byte(parts[2])) {
		return "", false
	}
	return parts[0], true
}

// GenerateTokens is exposed on AuthService so SSO callbacks can mint
// the same access/refresh pair as a password login. Defined here only
// because Go can't add methods across packages.
func (s *AuthService) GenerateTokens(ctx context.Context, user *models.User) (*TokenPair, error) {
	return s.generateTokens(ctx, user)
}

func uuidString(id pgtype.UUID) string {
	if !id.Valid {
		return ""
	}
	b := id.Bytes
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

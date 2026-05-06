package service

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/pquerna/otp/totp"
	"golang.org/x/crypto/bcrypt"

	"github.com/dbbaskette/northstar/internal/models"
	"github.com/dbbaskette/northstar/internal/repository"
)

type AuthService struct {
	userRepo    *repository.UserRepo
	sessionRepo *repository.SessionRepo
	twofaRepo   *repository.TwoFARepo
	pool        *pgxpool.Pool
	jwtSecret   []byte
}

type TokenPair struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
}

func NewAuthService(userRepo *repository.UserRepo, pool *pgxpool.Pool, jwtSecret string) *AuthService {
	return &AuthService{
		userRepo:  userRepo,
		pool:      pool,
		jwtSecret: []byte(jwtSecret),
	}
}

// SetSessions wires optional session + 2FA repos in a second step so
// older callers (tests, fixtures) don't need to thread them through
// the constructor.
func (s *AuthService) SetSessions(sessions *repository.SessionRepo, twofa *repository.TwoFARepo) {
	s.sessionRepo = sessions
	s.twofaRepo = twofa
}

// ErrTwoFARequired signals that the caller must collect a TOTP code
// from the user and retry Login with it.
var ErrTwoFARequired = errors.New("2fa_required")

func (s *AuthService) Register(ctx context.Context, email, username, password, displayName string) (*models.User, *TokenPair, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, nil, fmt.Errorf("hashing password: %w", err)
	}

	user := &models.User{
		Email:        email,
		Username:     username,
		PasswordHash: string(hash),
		DisplayName:  displayName,
		Role:         "member",
	}

	if err := s.userRepo.Create(ctx, user); err != nil {
		return nil, nil, fmt.Errorf("creating user: %w", err)
	}

	tokens, err := s.generateTokens(ctx, user)
	if err != nil {
		return nil, nil, err
	}

	return user, tokens, nil
}

// LoginInput bundles the optional bits the auth handler can pass —
// keeps Login's signature stable as new factors get added.
type LoginInput struct {
	Email    string
	Password string
	TOTPCode string
	IP       string
	UserAgent string
}

func (s *AuthService) Login(ctx context.Context, in LoginInput) (*models.User, *TokenPair, error) {
	user, err := s.userRepo.FindByEmail(ctx, in.Email)
	if err != nil {
		return nil, nil, fmt.Errorf("invalid credentials")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(in.Password)); err != nil {
		return nil, nil, fmt.Errorf("invalid credentials")
	}

	if active, err := s.userRepo.IsActive(ctx, uuidToString(user.ID)); err != nil || !active {
		return nil, nil, fmt.Errorf("account is deactivated")
	}

	if s.twofaRepo != nil {
		row, _ := s.twofaRepo.Get(ctx, uuidToString(user.ID))
		if row != nil && row.EnabledAt != nil {
			if in.TOTPCode == "" {
				return nil, nil, ErrTwoFARequired
			}
			if !totp.Validate(in.TOTPCode, row.TOTPSecret) {
				return nil, nil, fmt.Errorf("invalid 2fa code")
			}
		}
	}

	tokens, err := s.issueSession(ctx, user, in.IP, in.UserAgent)
	if err != nil {
		return nil, nil, err
	}

	return user, tokens, nil
}

func (s *AuthService) Refresh(ctx context.Context, refreshToken string) (string, error) {
	tokenHash := hashToken(refreshToken)

	var userID string
	var expiresAt time.Time
	err := s.pool.QueryRow(ctx,
		`SELECT user_id, expires_at FROM refresh_tokens WHERE token_hash = $1`,
		tokenHash,
	).Scan(&userID, &expiresAt)
	if err != nil {
		return "", fmt.Errorf("invalid refresh token")
	}

	if time.Now().After(expiresAt) {
		s.pool.Exec(ctx, `DELETE FROM refresh_tokens WHERE token_hash = $1`, tokenHash)
		return "", fmt.Errorf("refresh token expired")
	}

	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		return "", err
	}

	if active, err := s.userRepo.IsActive(ctx, userID); err != nil || !active {
		return "", fmt.Errorf("account is deactivated")
	}

	// Refresh mints a fresh session row with its own jti so revoking
	// the original session also kills any newer access tokens spawned
	// from it. Tighter than reusing the old jti and matches the
	// "revoke immediately invalidates" expectation.
	jti, err := newJTI()
	if err != nil {
		return "", err
	}
	if s.sessionRepo != nil {
		if err := s.sessionRepo.Create(ctx, userID, jti, "", ""); err != nil {
			return "", err
		}
	}
	accessToken, err := s.generateAccessToken(user, jti)
	if err != nil {
		return "", err
	}

	return accessToken, nil
}

func (s *AuthService) ValidateAccessToken(tokenString string) (string, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method")
		}
		return s.jwtSecret, nil
	})
	if err != nil {
		return "", fmt.Errorf("invalid token: %w", err)
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok || !token.Valid {
		return "", fmt.Errorf("invalid token claims")
	}

	userID, ok := claims["sub"].(string)
	if !ok {
		return "", fmt.Errorf("invalid token subject")
	}

	// Reject tokens whose session row is gone or revoked. JTI was
	// added to the claims with the sessions feature; older tokens
	// (without jti) keep working until they expire — 15-minute TTL
	// makes that window short.
	if s.sessionRepo != nil {
		if jti, _ := claims["jti"].(string); jti != "" {
			active, err := s.sessionRepo.IsActive(context.Background(), jti)
			if err != nil || !active {
				return "", fmt.Errorf("session revoked")
			}
		}
	}

	return userID, nil
}

func (s *AuthService) generateTokens(ctx context.Context, user *models.User) (*TokenPair, error) {
	return s.issueSession(ctx, user, "", "")
}

// issueSession is the shared bottom-half of Login + SSO — mints a
// JTI, persists a session row, and returns the access + refresh
// pair carrying that JTI.
func (s *AuthService) issueSession(ctx context.Context, user *models.User, ip, ua string) (*TokenPair, error) {
	jti, err := newJTI()
	if err != nil {
		return nil, err
	}
	if s.sessionRepo != nil {
		if err := s.sessionRepo.Create(ctx, uuidToString(user.ID), jti, ip, ua); err != nil {
			return nil, fmt.Errorf("creating session: %w", err)
		}
	}
	accessToken, err := s.generateAccessToken(user, jti)
	if err != nil {
		return nil, err
	}
	refreshToken, err := s.generateRefreshToken(ctx, user)
	if err != nil {
		return nil, err
	}
	return &TokenPair{AccessToken: accessToken, RefreshToken: refreshToken}, nil
}

func newJTI() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func (s *AuthService) generateAccessToken(user *models.User, jti string) (string, error) {
	claims := jwt.MapClaims{
		"sub":   uuidToString(user.ID),
		"email": user.Email,
		"role":  user.Role,
		"jti":   jti,
		"exp":   time.Now().Add(15 * time.Minute).Unix(),
		"iat":   time.Now().Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(s.jwtSecret)
}

func (s *AuthService) generateRefreshToken(ctx context.Context, user *models.User) (string, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	refreshToken := hex.EncodeToString(raw)
	tokenHash := hashToken(refreshToken)
	expiresAt := time.Now().Add(7 * 24 * time.Hour)

	_, err := s.pool.Exec(ctx,
		`INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
		uuidToString(user.ID), tokenHash, expiresAt,
	)
	if err != nil {
		return "", fmt.Errorf("storing refresh token: %w", err)
	}

	return refreshToken, nil
}

func hashToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}

func uuidToString(id pgtype.UUID) string {
	if !id.Valid {
		return ""
	}
	b := id.Bytes
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

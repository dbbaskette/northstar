package service

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	"github.com/dbbaskette/northstar/internal/models"
	"github.com/dbbaskette/northstar/internal/repository"
)

type AuthService struct {
	userRepo  *repository.UserRepo
	pool      *pgxpool.Pool
	jwtSecret []byte
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

func (s *AuthService) Login(ctx context.Context, email, password string) (*models.User, *TokenPair, error) {
	user, err := s.userRepo.FindByEmail(ctx, email)
	if err != nil {
		return nil, nil, fmt.Errorf("invalid credentials")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return nil, nil, fmt.Errorf("invalid credentials")
	}

	tokens, err := s.generateTokens(ctx, user)
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

	accessToken, err := s.generateAccessToken(user)
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

	return userID, nil
}

func (s *AuthService) generateTokens(ctx context.Context, user *models.User) (*TokenPair, error) {
	accessToken, err := s.generateAccessToken(user)
	if err != nil {
		return nil, err
	}

	refreshToken, err := s.generateRefreshToken(ctx, user)
	if err != nil {
		return nil, err
	}

	return &TokenPair{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
	}, nil
}

func (s *AuthService) generateAccessToken(user *models.User) (string, error) {
	claims := jwt.MapClaims{
		"sub":   uuidToString(user.ID),
		"email": user.Email,
		"role":  user.Role,
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

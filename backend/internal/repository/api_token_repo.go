package repository

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type APITokenRepo struct {
	pool *pgxpool.Pool
}

func NewAPITokenRepo(pool *pgxpool.Pool) *APITokenRepo {
	return &APITokenRepo{pool: pool}
}

type APIToken struct {
	ID         pgtype.UUID        `json:"id"`
	UserID     pgtype.UUID        `json:"user_id"`
	Name       string             `json:"name"`
	LastUsedAt pgtype.Timestamptz `json:"last_used_at,omitempty"`
	ExpiresAt  pgtype.Timestamptz `json:"expires_at,omitempty"`
	CreatedAt  time.Time          `json:"created_at"`

	// Plain token only set on Create (never persisted unhashed).
	Token string `json:"token,omitempty"`
}

// Create generates a new API token. The plaintext value is returned ONCE
// in `Token`; only the SHA-256 hash is stored.
func (r *APITokenRepo) Create(ctx context.Context, userID, name string, expiresInDays int) (*APIToken, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return nil, err
	}
	plain := "ns_" + hex.EncodeToString(raw)
	hash := sha256.Sum256([]byte(plain))
	hashHex := hex.EncodeToString(hash[:])

	var expiresAt pgtype.Timestamptz
	if expiresInDays > 0 {
		expiresAt = pgtype.Timestamptz{Time: time.Now().Add(time.Duration(expiresInDays) * 24 * time.Hour), Valid: true}
	}

	tok := &APIToken{
		Name:      name,
		ExpiresAt: expiresAt,
		Token:     plain,
	}
	tok.UserID.Scan(userID)

	const q = `
		INSERT INTO api_tokens (user_id, name, token_hash, expires_at)
		VALUES ($1, $2, $3, $4)
		RETURNING id, created_at`
	if err := r.pool.QueryRow(ctx, q, userID, name, hashHex, expiresAt).
		Scan(&tok.ID, &tok.CreatedAt); err != nil {
		return nil, err
	}
	return tok, nil
}

func (r *APITokenRepo) ListByUser(ctx context.Context, userID string) ([]APIToken, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, user_id, name, last_used_at, expires_at, created_at
		 FROM api_tokens WHERE user_id = $1 ORDER BY created_at DESC`,
		userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []APIToken
	for rows.Next() {
		var t APIToken
		if err := rows.Scan(&t.ID, &t.UserID, &t.Name, &t.LastUsedAt, &t.ExpiresAt, &t.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

func (r *APITokenRepo) Delete(ctx context.Context, id, userID string) error {
	ct, err := r.pool.Exec(ctx,
		`DELETE FROM api_tokens WHERE id = $1 AND user_id = $2`, id, userID)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return fmt.Errorf("token not found")
	}
	return nil
}

// LookupByToken hashes the supplied plaintext and returns the user_id if
// the token exists and isn't expired. Updates last_used_at.
func (r *APITokenRepo) LookupByToken(ctx context.Context, plain string) (string, error) {
	hash := sha256.Sum256([]byte(plain))
	hashHex := hex.EncodeToString(hash[:])

	var (
		id, userID string
		expiresAt  pgtype.Timestamptz
	)
	err := r.pool.QueryRow(ctx,
		`SELECT id::text, user_id::text, expires_at FROM api_tokens WHERE token_hash = $1`,
		hashHex).Scan(&id, &userID, &expiresAt)
	if err == pgx.ErrNoRows {
		return "", fmt.Errorf("token not found")
	}
	if err != nil {
		return "", err
	}
	if expiresAt.Valid && time.Now().After(expiresAt.Time) {
		return "", fmt.Errorf("token expired")
	}

	// Best-effort last_used update; don't block on errors.
	go func() {
		_, _ = r.pool.Exec(context.Background(),
			`UPDATE api_tokens SET last_used_at = NOW() WHERE id = $1`, id)
	}()

	return userID, nil
}

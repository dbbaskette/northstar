package repository

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type TwoFA struct {
	UserID      string     `json:"user_id"`
	TOTPSecret  string     `json:"-"`
	EnabledAt   *time.Time `json:"enabled_at,omitempty"`
}

type TwoFARepo struct {
	pool *pgxpool.Pool
}

func NewTwoFARepo(pool *pgxpool.Pool) *TwoFARepo {
	return &TwoFARepo{pool: pool}
}

// SaveSecret inserts or replaces the user's TOTP secret in setup mode
// (enabled_at remains NULL). Verifying a code with Enable() flips
// enabled_at to NOW().
func (r *TwoFARepo) SaveSecret(ctx context.Context, userID, secret string) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO user_2fa (user_id, totp_secret) VALUES ($1, $2)
		ON CONFLICT (user_id) DO UPDATE SET totp_secret = EXCLUDED.totp_secret, enabled_at = NULL`,
		userID, secret)
	return err
}

func (r *TwoFARepo) Enable(ctx context.Context, userID string) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE user_2fa SET enabled_at = NOW() WHERE user_id = $1`, userID)
	return err
}

func (r *TwoFARepo) Disable(ctx context.Context, userID string) error {
	_, err := r.pool.Exec(ctx,
		`DELETE FROM user_2fa WHERE user_id = $1`, userID)
	return err
}

// Get returns the row or nil if 2FA is not configured.
func (r *TwoFARepo) Get(ctx context.Context, userID string) (*TwoFA, error) {
	t := &TwoFA{UserID: userID}
	err := r.pool.QueryRow(ctx, `
		SELECT totp_secret, enabled_at FROM user_2fa WHERE user_id = $1`, userID).
		Scan(&t.TOTPSecret, &t.EnabledAt)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return t, err
}

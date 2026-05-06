package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Session struct {
	ID          string     `json:"id"`
	UserID      string     `json:"user_id"`
	JTI         string     `json:"-"`
	IP          string     `json:"ip"`
	UserAgent   string     `json:"user_agent"`
	CreatedAt   time.Time  `json:"created_at"`
	LastSeenAt  time.Time  `json:"last_seen_at"`
	RevokedAt   *time.Time `json:"revoked_at,omitempty"`
	IsCurrent   bool       `json:"is_current,omitempty"`
}

type SessionRepo struct {
	pool *pgxpool.Pool
}

func NewSessionRepo(pool *pgxpool.Pool) *SessionRepo {
	return &SessionRepo{pool: pool}
}

func (r *SessionRepo) Create(ctx context.Context, userID, jti, ip, ua string) error {
	_, err := r.pool.Exec(ctx,
		`INSERT INTO sessions (user_id, jti, ip, user_agent)
		 VALUES ($1, $2, NULLIF($3, ''), NULLIF($4, ''))`,
		userID, jti, ip, ua)
	return err
}

// IsActive returns true if the session for the given JTI exists and
// has not been revoked. Used on every authenticated request.
func (r *SessionRepo) IsActive(ctx context.Context, jti string) (bool, error) {
	var revoked *time.Time
	err := r.pool.QueryRow(ctx,
		`SELECT revoked_at FROM sessions WHERE jti = $1`, jti).Scan(&revoked)
	if err != nil {
		return false, err
	}
	return revoked == nil, nil
}

// Touch updates last_seen_at — called on a sampled basis from the
// auth middleware so the sessions table doesn't get hammered.
func (r *SessionRepo) Touch(ctx context.Context, jti string) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE sessions SET last_seen_at = NOW() WHERE jti = $1`, jti)
	return err
}

func (r *SessionRepo) ListForUser(ctx context.Context, userID string) ([]Session, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id::text, user_id::text, jti,
		       COALESCE(ip, ''), COALESCE(user_agent, ''),
		       created_at, last_seen_at, revoked_at
		FROM sessions
		WHERE user_id = $1
		ORDER BY last_seen_at DESC NULLS LAST, created_at DESC
		LIMIT 50`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []Session{}
	for rows.Next() {
		var s Session
		if err := rows.Scan(
			&s.ID, &s.UserID, &s.JTI, &s.IP, &s.UserAgent,
			&s.CreatedAt, &s.LastSeenAt, &s.RevokedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

func (r *SessionRepo) Revoke(ctx context.Context, sessionID, userID string) error {
	ct, err := r.pool.Exec(ctx,
		`UPDATE sessions SET revoked_at = NOW()
		 WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL`,
		sessionID, userID)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return fmt.Errorf("session not found")
	}
	return nil
}

// FindByJTI is used by the admin "current session" hint in /me/sessions.
func (r *SessionRepo) FindByJTI(ctx context.Context, jti string) (*Session, error) {
	s := &Session{}
	err := r.pool.QueryRow(ctx, `
		SELECT id::text, user_id::text, jti,
		       COALESCE(ip, ''), COALESCE(user_agent, ''),
		       created_at, last_seen_at, revoked_at
		FROM sessions WHERE jti = $1`, jti).Scan(
		&s.ID, &s.UserID, &s.JTI, &s.IP, &s.UserAgent,
		&s.CreatedAt, &s.LastSeenAt, &s.RevokedAt,
	)
	if err != nil {
		return nil, err
	}
	return s, nil
}

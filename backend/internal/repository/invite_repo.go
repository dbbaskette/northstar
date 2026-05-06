package repository

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type InviteRepo struct {
	pool *pgxpool.Pool
}

func NewInviteRepo(pool *pgxpool.Pool) *InviteRepo {
	return &InviteRepo{pool: pool}
}

type Invite struct {
	ID                pgtype.UUID        `json:"id"`
	BoardID           pgtype.UUID        `json:"board_id"`
	Token             string             `json:"token"`
	Email             pgtype.Text        `json:"email,omitempty"`
	Role              string             `json:"role"`
	ExpiresAt         pgtype.Timestamptz `json:"expires_at,omitempty"`
	CreatedBy         pgtype.UUID        `json:"created_by"`
	CreatedAt         time.Time          `json:"created_at"`
	AcceptedAt        pgtype.Timestamptz `json:"accepted_at,omitempty"`
	AcceptedByUserID  pgtype.UUID        `json:"accepted_by_user_id,omitempty"`

	// Populated by FindByToken for the accept page
	BoardName  string `json:"board_name,omitempty"`
	TeamName   string `json:"team_name,omitempty"`
	InviterName string `json:"inviter_name,omitempty"`
}

func generateToken() string {
	b := make([]byte, 24)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func (r *InviteRepo) Create(ctx context.Context, boardID, createdBy, email, role string, expiresInDays int) (*Invite, error) {
	if role == "" {
		role = "member"
	}
	token := generateToken()

	var expiresAt pgtype.Timestamptz
	if expiresInDays > 0 {
		expiresAt = pgtype.Timestamptz{Time: time.Now().Add(time.Duration(expiresInDays) * 24 * time.Hour), Valid: true}
	}

	var emailVal pgtype.Text
	if email != "" {
		emailVal = pgtype.Text{String: email, Valid: true}
	}

	const q = `
		INSERT INTO board_invites (board_id, token, email, role, expires_at, created_by)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, created_at`

	inv := &Invite{
		Token:     token,
		Email:     emailVal,
		Role:      role,
		ExpiresAt: expiresAt,
	}
	inv.BoardID.Scan(boardID)
	inv.CreatedBy.Scan(createdBy)

	if err := r.pool.QueryRow(ctx, q, boardID, token, emailVal, role, expiresAt, createdBy).
		Scan(&inv.ID, &inv.CreatedAt); err != nil {
		return nil, err
	}
	return inv, nil
}

func (r *InviteRepo) ListByBoard(ctx context.Context, boardID string) ([]Invite, error) {
	const q = `
		SELECT id, board_id, token, email, role::text, expires_at, created_by, created_at, accepted_at, accepted_by_user_id
		FROM board_invites
		WHERE board_id = $1
		ORDER BY created_at DESC`

	rows, err := r.pool.Query(ctx, q, boardID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Invite
	for rows.Next() {
		var i Invite
		if err := rows.Scan(
			&i.ID, &i.BoardID, &i.Token, &i.Email, &i.Role, &i.ExpiresAt,
			&i.CreatedBy, &i.CreatedAt, &i.AcceptedAt, &i.AcceptedByUserID,
		); err != nil {
			return nil, err
		}
		out = append(out, i)
	}
	return out, rows.Err()
}

func (r *InviteRepo) FindByToken(ctx context.Context, token string) (*Invite, error) {
	const q = `
		SELECT i.id, i.board_id, i.token, i.email, i.role::text, i.expires_at,
		       i.created_by, i.created_at, i.accepted_at, i.accepted_by_user_id,
		       b.name, t.name, COALESCE(u.display_name, '')
		FROM board_invites i
		JOIN boards b ON i.board_id = b.id
		JOIN teams  t ON b.team_id = t.id
		LEFT JOIN users u ON i.created_by = u.id
		WHERE i.token = $1`

	i := &Invite{}
	err := r.pool.QueryRow(ctx, q, token).Scan(
		&i.ID, &i.BoardID, &i.Token, &i.Email, &i.Role, &i.ExpiresAt,
		&i.CreatedBy, &i.CreatedAt, &i.AcceptedAt, &i.AcceptedByUserID,
		&i.BoardName, &i.TeamName, &i.InviterName,
	)
	if err == pgx.ErrNoRows {
		return nil, fmt.Errorf("invite not found")
	}
	return i, err
}

func (r *InviteRepo) MarkAccepted(ctx context.Context, id, userID string) error {
	ct, err := r.pool.Exec(ctx,
		`UPDATE board_invites SET accepted_at = NOW(), accepted_by_user_id = $2
		 WHERE id = $1 AND accepted_at IS NULL`, id, userID)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return fmt.Errorf("invite already accepted or not found")
	}
	return nil
}

func (r *InviteRepo) Delete(ctx context.Context, id string) error {
	ct, err := r.pool.Exec(ctx, `DELETE FROM board_invites WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return fmt.Errorf("invite not found")
	}
	return nil
}

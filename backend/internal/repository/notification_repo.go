package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type NotificationRepo struct {
	pool *pgxpool.Pool
}

func NewNotificationRepo(pool *pgxpool.Pool) *NotificationRepo {
	return &NotificationRepo{pool: pool}
}

type Notification struct {
	ID            pgtype.UUID     `json:"id"`
	UserID        pgtype.UUID     `json:"user_id"`
	Type          string          `json:"type"`
	Payload       json.RawMessage `json:"payload"`
	SourceCardID  pgtype.UUID     `json:"source_card_id,omitempty"`
	SourceBoardID pgtype.UUID     `json:"source_board_id,omitempty"`
	IsRead        bool            `json:"is_read"`
	CreatedAt     time.Time       `json:"created_at"`
}

func (r *NotificationRepo) Create(
	ctx context.Context,
	userID, notifType string,
	payload interface{},
	sourceCardID, sourceBoardID string,
) error {
	raw, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	var cardID, boardID pgtype.UUID
	if sourceCardID != "" {
		cardID.Scan(sourceCardID)
	}
	if sourceBoardID != "" {
		boardID.Scan(sourceBoardID)
	}

	_, err = r.pool.Exec(ctx, `
		INSERT INTO notifications (user_id, type, payload, source_card_id, source_board_id)
		VALUES ($1, $2, $3, $4, $5)`,
		userID, notifType, raw, cardID, boardID)
	return err
}

func (r *NotificationRepo) ListByUser(ctx context.Context, userID string, limit int, unreadOnly bool) ([]Notification, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	q := `
		SELECT id, user_id, type, payload, source_card_id, source_board_id, is_read, created_at
		FROM notifications
		WHERE user_id = $1`
	if unreadOnly {
		q += ` AND is_read = FALSE`
	}
	q += ` ORDER BY created_at DESC LIMIT $2`

	rows, err := r.pool.Query(ctx, q, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Notification
	for rows.Next() {
		var n Notification
		if err := rows.Scan(
			&n.ID, &n.UserID, &n.Type, &n.Payload,
			&n.SourceCardID, &n.SourceBoardID, &n.IsRead, &n.CreatedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, n)
	}
	return out, rows.Err()
}

func (r *NotificationRepo) UnreadCount(ctx context.Context, userID string) (int, error) {
	var n int
	err := r.pool.QueryRow(ctx,
		`SELECT COUNT(*)::int FROM notifications WHERE user_id = $1 AND is_read = FALSE`,
		userID).Scan(&n)
	return n, err
}

func (r *NotificationRepo) MarkRead(ctx context.Context, id, userID string) error {
	ct, err := r.pool.Exec(ctx,
		`UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2`,
		id, userID)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return fmt.Errorf("notification not found")
	}
	return nil
}

func (r *NotificationRepo) MarkAllRead(ctx context.Context, userID string) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE`,
		userID)
	return err
}

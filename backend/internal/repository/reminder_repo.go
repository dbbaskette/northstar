package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ReminderRepo struct {
	pool *pgxpool.Pool
}

func NewReminderRepo(pool *pgxpool.Pool) *ReminderRepo {
	return &ReminderRepo{pool: pool}
}

type Reminder struct {
	ID           pgtype.UUID        `json:"id"`
	CardID       pgtype.UUID        `json:"card_id"`
	UserID       pgtype.UUID        `json:"user_id,omitempty"`
	LeadMinutes  int                `json:"lead_minutes"`
	SentAt       pgtype.Timestamptz `json:"sent_at,omitempty"`
	CreatedAt    time.Time          `json:"created_at"`
}

// Create adds a reminder. Idempotent on (card_id, user_id, lead_minutes).
// Pass userID = "" to mean "all assignees" — stored as NULL.
func (r *ReminderRepo) Create(ctx context.Context, cardID, userID string, leadMinutes int) error {
	var uid pgtype.UUID
	if userID != "" {
		if err := uid.Scan(userID); err != nil {
			return err
		}
	}
	_, err := r.pool.Exec(ctx, `
		INSERT INTO reminders (card_id, user_id, lead_minutes) VALUES ($1, $2, $3)
		ON CONFLICT DO NOTHING`,
		cardID, uid, leadMinutes)
	return err
}

func (r *ReminderRepo) Delete(ctx context.Context, id string) error {
	ct, err := r.pool.Exec(ctx, `DELETE FROM reminders WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return fmt.Errorf("reminder not found")
	}
	return nil
}

func (r *ReminderRepo) ListByCard(ctx context.Context, cardID string) ([]Reminder, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, card_id, user_id, lead_minutes, sent_at, created_at
		 FROM reminders WHERE card_id = $1 ORDER BY lead_minutes`, cardID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Reminder
	for rows.Next() {
		var rm Reminder
		if err := rows.Scan(&rm.ID, &rm.CardID, &rm.UserID, &rm.LeadMinutes, &rm.SentAt, &rm.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, rm)
	}
	return out, rows.Err()
}

// PendingDue returns reminders whose due time has been crossed.
// Each row in the result has both the reminder id and the data needed
// to fire a notification.
type PendingReminder struct {
	ID           string
	CardID       string
	BoardID      string
	CardTitle    string
	UserID       string // empty means "all assignees"
	DueDate      time.Time
	LeadMinutes  int
}

func (r *ReminderRepo) PendingDue(ctx context.Context, now time.Time, limit int) ([]PendingReminder, error) {
	if limit <= 0 {
		limit = 100
	}
	rows, err := r.pool.Query(ctx, `
		SELECT r.id::text, c.id::text, l.board_id::text, c.title, COALESCE(r.user_id::text, ''),
		       c.due_date, r.lead_minutes
		FROM reminders r
		JOIN cards c ON r.card_id = c.id
		JOIN lists l ON c.list_id = l.id
		WHERE r.sent_at IS NULL
		  AND c.deleted_at IS NULL
		  AND c.is_archived = FALSE
		  AND c.due_date IS NOT NULL
		  AND c.completed_at IS NULL
		  AND c.due_date - (r.lead_minutes * INTERVAL '1 minute') <= $1
		LIMIT $2`,
		now, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []PendingReminder
	for rows.Next() {
		var p PendingReminder
		if err := rows.Scan(&p.ID, &p.CardID, &p.BoardID, &p.CardTitle, &p.UserID,
			&p.DueDate, &p.LeadMinutes); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (r *ReminderRepo) MarkSent(ctx context.Context, id string) error {
	_, err := r.pool.Exec(ctx, `UPDATE reminders SET sent_at = NOW() WHERE id = $1`, id)
	return err
}

// AssigneesForCard returns the user_ids assigned to a card. Used by the
// reminder worker when a reminder targets "all assignees".
func (r *ReminderRepo) AssigneesForCard(ctx context.Context, cardID string) ([]string, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT user_id::text FROM card_assignees WHERE card_id = $1`, cardID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out = append(out, id)
	}
	return out, rows.Err()
}

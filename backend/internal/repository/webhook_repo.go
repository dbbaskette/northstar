package repository

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type WebhookRepo struct {
	pool *pgxpool.Pool
}

func NewWebhookRepo(pool *pgxpool.Pool) *WebhookRepo {
	return &WebhookRepo{pool: pool}
}

type Webhook struct {
	ID           pgtype.UUID `json:"id"`
	BoardID      pgtype.UUID `json:"board_id"`
	URL          string      `json:"url"`
	Secret       string      `json:"secret"`
	EventFilters []string    `json:"event_filters"`
	Active       bool        `json:"active"`
	CreatedBy    pgtype.UUID `json:"created_by"`
	CreatedAt    time.Time   `json:"created_at"`
}

type WebhookDelivery struct {
	ID           pgtype.UUID        `json:"id"`
	WebhookID    pgtype.UUID        `json:"webhook_id"`
	Event        string             `json:"event"`
	Status       string             `json:"status"`
	ResponseCode pgtype.Int4        `json:"response_code,omitempty"`
	ResponseBody pgtype.Text        `json:"response_body,omitempty"`
	Attempts     int                `json:"attempts"`
	QueuedAt     time.Time          `json:"queued_at"`
	DeliveredAt  pgtype.Timestamptz `json:"delivered_at,omitempty"`
}

func generateSecret() string {
	b := make([]byte, 24)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func (r *WebhookRepo) Create(ctx context.Context, boardID, url, createdBy string, filters []string) (*Webhook, error) {
	if filters == nil {
		filters = []string{}
	}
	filtersJSON, _ := json.Marshal(filters)
	w := &Webhook{
		URL:          url,
		Secret:       generateSecret(),
		EventFilters: filters,
		Active:       true,
	}
	w.BoardID.Scan(boardID)
	w.CreatedBy.Scan(createdBy)

	if err := r.pool.QueryRow(ctx, `
		INSERT INTO webhooks (board_id, url, secret, event_filters, created_by)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at`,
		boardID, url, w.Secret, filtersJSON, createdBy,
	).Scan(&w.ID, &w.CreatedAt); err != nil {
		return nil, err
	}
	return w, nil
}

func (r *WebhookRepo) ListByBoard(ctx context.Context, boardID string) ([]Webhook, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, board_id, url, secret, event_filters, active, created_by, created_at
		 FROM webhooks WHERE board_id = $1 ORDER BY created_at DESC`, boardID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Webhook
	for rows.Next() {
		var (
			w           Webhook
			filtersJSON []byte
		)
		if err := rows.Scan(&w.ID, &w.BoardID, &w.URL, &w.Secret, &filtersJSON,
			&w.Active, &w.CreatedBy, &w.CreatedAt); err != nil {
			return nil, err
		}
		_ = json.Unmarshal(filtersJSON, &w.EventFilters)
		out = append(out, w)
	}
	return out, rows.Err()
}

func (r *WebhookRepo) Delete(ctx context.Context, id string) error {
	ct, err := r.pool.Exec(ctx, `DELETE FROM webhooks WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return fmt.Errorf("webhook not found")
	}
	return nil
}

// MatchingHooks returns webhooks for a board whose filter list either is
// empty (subscribes to everything) or contains the event.
func (r *WebhookRepo) MatchingHooks(ctx context.Context, boardID, event string) ([]Webhook, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, board_id, url, secret, event_filters, active, created_by, created_at
		FROM webhooks
		WHERE board_id = $1 AND active = TRUE
		  AND (jsonb_array_length(event_filters) = 0 OR event_filters @> to_jsonb($2::text))`,
		boardID, event)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Webhook
	for rows.Next() {
		var (
			w           Webhook
			filtersJSON []byte
		)
		if err := rows.Scan(&w.ID, &w.BoardID, &w.URL, &w.Secret, &filtersJSON,
			&w.Active, &w.CreatedBy, &w.CreatedAt); err != nil {
			return nil, err
		}
		_ = json.Unmarshal(filtersJSON, &w.EventFilters)
		out = append(out, w)
	}
	return out, rows.Err()
}

// QueueDelivery inserts a pending delivery row.
func (r *WebhookRepo) QueueDelivery(ctx context.Context, webhookID, event string, payload []byte) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO webhook_deliveries (webhook_id, event, payload)
		VALUES ($1, $2, $3)`,
		webhookID, event, payload)
	return err
}

// PendingDeliveries returns deliveries due for an attempt.
type DeliveryDispatch struct {
	ID         string
	WebhookID  string
	URL        string
	Secret     string
	Event      string
	Payload    []byte
	Attempts   int
}

func (r *WebhookRepo) PendingDeliveries(ctx context.Context, now time.Time, limit int) ([]DeliveryDispatch, error) {
	if limit <= 0 {
		limit = 50
	}
	rows, err := r.pool.Query(ctx, `
		SELECT d.id::text, d.webhook_id::text, w.url, w.secret, d.event, d.payload, d.attempts
		FROM webhook_deliveries d
		JOIN webhooks w ON d.webhook_id = w.id
		WHERE d.status IN ('pending', 'retrying')
		  AND d.next_attempt <= $1
		  AND w.active = TRUE
		ORDER BY d.next_attempt
		LIMIT $2`,
		now, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []DeliveryDispatch
	for rows.Next() {
		var d DeliveryDispatch
		if err := rows.Scan(&d.ID, &d.WebhookID, &d.URL, &d.Secret, &d.Event, &d.Payload, &d.Attempts); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}

func (r *WebhookRepo) MarkDelivered(ctx context.Context, id string, code int, body string) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE webhook_deliveries
		SET status = 'delivered',
		    response_code = $2,
		    response_body = $3,
		    attempts = attempts + 1,
		    delivered_at = NOW()
		WHERE id = $1`, id, code, body)
	return err
}

// MarkRetry bumps attempts and schedules the next retry with exponential
// backoff. Gives up after 5 attempts.
func (r *WebhookRepo) MarkRetry(ctx context.Context, id string, code int, body string, currentAttempts int) error {
	const maxAttempts = 5
	if currentAttempts+1 >= maxAttempts {
		_, err := r.pool.Exec(ctx, `
			UPDATE webhook_deliveries
			SET status = 'failed',
			    response_code = $2,
			    response_body = $3,
			    attempts = attempts + 1
			WHERE id = $1`, id, code, body)
		return err
	}

	delay := time.Duration(1<<uint(currentAttempts)) * 30 * time.Second // 30s, 1m, 2m, 4m
	_, err := r.pool.Exec(ctx, `
		UPDATE webhook_deliveries
		SET status = 'retrying',
		    response_code = $2,
		    response_body = $3,
		    attempts = attempts + 1,
		    next_attempt = NOW() + $4::interval
		WHERE id = $1`, id, code, body, fmt.Sprintf("%d milliseconds", delay.Milliseconds()))
	return err
}

func (r *WebhookRepo) ListDeliveries(ctx context.Context, webhookID string, limit int) ([]WebhookDelivery, error) {
	if limit <= 0 || limit > 100 {
		limit = 25
	}
	rows, err := r.pool.Query(ctx, `
		SELECT id, webhook_id, event, status, response_code, response_body, attempts, queued_at, delivered_at
		FROM webhook_deliveries WHERE webhook_id = $1
		ORDER BY queued_at DESC LIMIT $2`, webhookID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []WebhookDelivery
	for rows.Next() {
		var d WebhookDelivery
		if err := rows.Scan(&d.ID, &d.WebhookID, &d.Event, &d.Status,
			&d.ResponseCode, &d.ResponseBody, &d.Attempts, &d.QueuedAt, &d.DeliveredAt); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}

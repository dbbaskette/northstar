package service

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/rs/zerolog/log"

	"github.com/dbbaskette/northstar/internal/repository"
)

func uuidStr(id pgtype.UUID) string {
	if !id.Valid {
		return ""
	}
	b := id.Bytes
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

// WebhookDispatcher fans Emit() events out to matching webhooks and
// runs a background loop that drains the delivery queue.
type WebhookDispatcher struct {
	hookRepo *repository.WebhookRepo
	client   *http.Client
}

func NewWebhookDispatcher(hookRepo *repository.WebhookRepo) *WebhookDispatcher {
	return &WebhookDispatcher{
		hookRepo: hookRepo,
		client:   &http.Client{Timeout: 10 * time.Second},
	}
}

// Enqueue creates one delivery row per matching webhook for the given event.
// Called from Events.Emit so any board event reaches subscribers.
func (d *WebhookDispatcher) Enqueue(
	ctx context.Context,
	boardID, event string,
	payload interface{},
) {
	if d == nil || d.hookRepo == nil {
		return
	}
	hooks, err := d.hookRepo.MatchingHooks(ctx, boardID, event)
	if err != nil {
		log.Warn().Err(err).Str("event", event).Msg("webhook lookup failed")
		return
	}
	if len(hooks) == 0 {
		return
	}
	body, err := json.Marshal(map[string]interface{}{
		"event":    event,
		"board_id": boardID,
		"data":     payload,
		"sent_at":  time.Now().UTC().Format(time.RFC3339),
	})
	if err != nil {
		return
	}
	for _, h := range hooks {
		if err := d.hookRepo.QueueDelivery(ctx, uuidStr(h.ID), event, body); err != nil {
			log.Warn().Err(err).Msg("queue delivery failed")
		}
	}
}

func (d *WebhookDispatcher) Run(ctx context.Context, interval time.Duration) {
	if interval <= 0 {
		interval = 10 * time.Second
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	d.tick(ctx)
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			d.tick(ctx)
		}
	}
}

func (d *WebhookDispatcher) tick(ctx context.Context) {
	pending, err := d.hookRepo.PendingDeliveries(ctx, time.Now(), 25)
	if err != nil {
		log.Warn().Err(err).Msg("pending deliveries scan failed")
		return
	}
	for _, dispatch := range pending {
		d.deliver(ctx, dispatch)
	}
}

func (d *WebhookDispatcher) deliver(ctx context.Context, dispatch repository.DeliveryDispatch) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, dispatch.URL, bytes.NewReader(dispatch.Payload))
	if err != nil {
		_ = d.hookRepo.MarkRetry(ctx, dispatch.ID, 0, err.Error(), dispatch.Attempts)
		return
	}
	mac := hmac.New(sha256.New, []byte(dispatch.Secret))
	mac.Write(dispatch.Payload)
	sig := hex.EncodeToString(mac.Sum(nil))

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "Northstar/1.0 (webhooks)")
	req.Header.Set("X-Northstar-Event", dispatch.Event)
	req.Header.Set("X-Northstar-Signature", "sha256="+sig)

	resp, err := d.client.Do(req)
	if err != nil {
		_ = d.hookRepo.MarkRetry(ctx, dispatch.ID, 0, err.Error(), dispatch.Attempts)
		return
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		_ = d.hookRepo.MarkDelivered(ctx, dispatch.ID, resp.StatusCode, string(body))
		return
	}
	_ = d.hookRepo.MarkRetry(ctx, dispatch.ID, resp.StatusCode, string(body), dispatch.Attempts)
}

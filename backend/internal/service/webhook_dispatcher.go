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

// formatGoogleChat wraps a Northstar event payload in the
// {"text": "..."} schema accepted by Google Chat incoming webhooks.
// The original event/data are also embedded after the summary so
// power users can build Chat-side automations off them.
func formatGoogleChat(event string, raw []byte) ([]byte, error) {
	var envelope struct {
		Event string                 `json:"event"`
		Data  map[string]interface{} `json:"data"`
	}
	_ = json.Unmarshal(raw, &envelope)

	verb := chatVerbForEvent(event)
	cardTitle, _ := envelope.Data["card_title"].(string)
	if cardTitle == "" {
		cardTitle, _ = envelope.Data["title"].(string)
	}

	summary := "Northstar: " + verb
	if cardTitle != "" {
		summary += " — " + cardTitle
	}
	summary += "  (`" + event + "`)"

	return json.Marshal(map[string]string{"text": summary})
}

func chatVerbForEvent(event string) string {
	switch event {
	case "card.created":
		return "card created"
	case "card.updated":
		return "card updated"
	case "card.moved":
		return "card moved"
	case "card.deleted":
		return "card deleted"
	case "card.reordered":
		return "card reordered"
	case "comment.added":
		return "new comment"
	case "list.created":
		return "list created"
	case "list.archived":
		return "list archived"
	case "label.attached":
		return "label attached"
	case "label.detached":
		return "label detached"
	}
	return event
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
	body := dispatch.Payload
	if dispatch.Format == "google_chat" {
		// Google Chat incoming-webhook spaces accept {text: "..."} or
		// rich card_v2 messages. We send a friendly summary line so the
		// channel stays readable.
		formatted, err := formatGoogleChat(dispatch.Event, dispatch.Payload)
		if err == nil {
			body = formatted
		}
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, dispatch.URL, bytes.NewReader(body))
	if err != nil {
		_ = d.hookRepo.MarkRetry(ctx, dispatch.ID, 0, err.Error(), dispatch.Attempts)
		return
	}

	// HMAC signature only meaningful for raw subscribers; Google Chat
	// authenticates the URL itself (the URL contains a token+key), so
	// we still include the header but it's harmless if ignored.
	mac := hmac.New(sha256.New, []byte(dispatch.Secret))
	mac.Write(body)
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
	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		_ = d.hookRepo.MarkDelivered(ctx, dispatch.ID, resp.StatusCode, string(respBody))
		return
	}
	_ = d.hookRepo.MarkRetry(ctx, dispatch.ID, resp.StatusCode, string(respBody), dispatch.Attempts)
}

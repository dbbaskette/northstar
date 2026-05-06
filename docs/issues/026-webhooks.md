# Outgoing webhooks

## Problem
External systems (CI, monitoring, custom tooling) need to react to board events. Without webhooks, integration requires polling.

## Acceptance criteria
- [ ] Per-board webhooks: URL, event filter, secret for HMAC signature
- [ ] Events: card.created, card.updated, card.moved, card.deleted, comment.added, list.* events
- [ ] Delivery log with retry on 5xx (exponential backoff, give up after N tries)
- [ ] Admin UI to inspect last N deliveries and replay

## Implementation notes
- DB: `webhooks(id, board_id, url, secret, event_filters_json, active, created_at)`, `webhook_deliveries(id, webhook_id, event, status, response_code, response_body, attempts, delivered_at)`
- Backend: queued delivery worker; signs payload with `HMAC-SHA256(secret, body)`
- Frontend: `BoardSettings → Webhooks` page

<!-- labels: P1,feature,backend,frontend,area:platform -->

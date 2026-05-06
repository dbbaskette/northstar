# Email-to-card (inbound email)

## Problem
Support and ops teams forward emails to a tracking system. A unique inbound email per board (or list) creating cards from email is a killer feature.

## Acceptance criteria
- [ ] Each board has a unique inbound email address (also per-list optional)
- [ ] Emails create cards: subject = title, body = description, attachments = card attachments
- [ ] Reply-to threads append comments to the original card

## Implementation notes
- DB: `board_email_addresses(id, board_id, list_id NULL, address_local, secret)`
- Inbound email infra: SES inbound, Postmark, or self-hosted SMTP server forwarding to a webhook
- Worker parses and creates cards via internal service

<!-- labels: P2,feature,backend,area:integrations,needs:inbound-email -->

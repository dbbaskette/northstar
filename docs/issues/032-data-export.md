# Data export per board and per workspace

## Problem
Self-hosted users want full data portability. Compliance (GDPR, SOC2) often requires user data export. There's currently no way to extract everything.

## Acceptance criteria
- [ ] Export a single board as JSON (lists, cards, comments, labels, attachments metadata)
- [ ] Export entire workspace as a ZIP of JSONs + attachment binaries
- [ ] Async job for large exports — emails a download link when ready
- [ ] CSV export of cards (flat) for spreadsheet use

## Implementation notes
- Backend: `POST /boards/:id/export` queues a job; `GET /exports/:id` polls status
- DB: `export_jobs(id, requested_by, scope, target_id, status, file_url, started_at, finished_at)`
- Storage: temporary signed URLs; 7-day retention

<!-- labels: P1,feature,backend,frontend,area:platform -->

# iCalendar feed for due dates

## Problem
Users want their cards' due dates to show in Google Calendar / Outlook / Apple Calendar without leaving Northstar open.

## Acceptance criteria
- [ ] Per-user iCal feed URL with secret token (default: cards assigned to you)
- [ ] Per-board iCal feed URL (all cards on the board)
- [ ] Feed updates show within calendar polling intervals (15-30 min)
- [ ] Revoke feed token from settings

## Implementation notes
- DB: `ical_tokens(id, user_id, board_id NULL, token, created_at, last_used_at)`
- Backend: `GET /ical/:token.ics` returning RFC 5545 ICS content
- Frontend: "Calendar feed" link in user settings + per-board

<!-- labels: P1,feature,backend,area:cards -->

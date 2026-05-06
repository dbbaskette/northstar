# Build a notifications system

## Problem
There is no way for users to know when something happens to them or their work — they have to revisit boards manually.

## Acceptance criteria
- [ ] Bell icon in the header with unread count
- [ ] Dropdown showing latest 20 notifications; "See all" goes to a full page
- [ ] Notification types: mention, assignment added/removed, comment on card you're on, due-date reminder, watched item changed
- [ ] Click on notification deep-links to the source card or board
- [ ] Mark single / all as read
- [ ] Per-type preferences page (in-app, email)

## Implementation notes
- DB: `notifications(id, user_id, type, payload_json, source_card_id NULL, source_board_id NULL, is_read, created_at)`, `notification_preferences(user_id, type, channel, enabled)`
- Backend: emitted by `service/events.go` extension; new repo + handler
- Frontend: `useNotifications` hook polling or WS-driven; `NotificationsBell.tsx`

<!-- labels: P0,feature,backend,frontend,area:collaboration -->

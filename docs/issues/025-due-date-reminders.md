# Due-date reminders

## Problem
Cards with due dates currently surprise people. Users want a reminder N hours/days before.

## Acceptance criteria
- [ ] Per-card reminder presets: at due time, 1 hour before, 1 day before, 1 week before, custom
- [ ] Reminder fires as in-app notification + optional email
- [ ] Per-user default reminder lead time
- [ ] Reminder respects card completion (skipped if completed)

## Implementation notes
- DB: `reminders(id, card_id, user_id NULL, lead_minutes, sent_at NULL)` — `user_id NULL` means all assignees
- Backend: cron worker scanning due dates each minute; emits notifications
- Depends on: issue 007 (notifications)

<!-- labels: P1,feature,backend,frontend,area:cards,needs:cron -->

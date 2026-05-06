# Card / list / board watching

## Problem
Users want to follow cards or boards they aren't assigned to (e.g., a manager watching a project). Without watching, they have to revisit manually.

## Acceptance criteria
- [ ] Eye icon on cards, lists, and boards toggles watch state
- [ ] Auto-watch on commenting or being assigned (with user pref to disable)
- [ ] Watched changes flow into the notifications system

## Implementation notes
- DB: `watchers(user_id, target_type, target_id, created_at)` PK on all three
- Backend: emit notifications when watched targets change
- Depends on: issue 007 (notifications)

<!-- labels: P1,feature,backend,frontend,area:collaboration -->

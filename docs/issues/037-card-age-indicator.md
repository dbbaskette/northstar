# Stale card / age indicator

## Problem
Cards quietly accumulate. Without a stale indicator, work that's been sitting for weeks blends in with active work.

## Acceptance criteria
- [ ] Per-board threshold (default 14 days since `updated_at`)
- [ ] Cards past threshold show a subtle aging dot or muted color band
- [ ] Toggle in board menu to highlight or hide aged cards
- [ ] Threshold editable by board admin

## Implementation notes
- DB: `boards.stale_threshold_days INT DEFAULT 14`
- Frontend: derive in `CardItem.tsx` from `updated_at`

<!-- labels: P2,feature,backend,frontend,area:cards -->

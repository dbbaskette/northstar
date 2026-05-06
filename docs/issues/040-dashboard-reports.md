# Dashboard / reports view

## Problem
PMs need answers to "where are we?" without exporting. Charts of cards per list, per assignee, per label, completion rate over time, due-date burndown.

## Acceptance criteria
- [ ] Per-board dashboard tab with a fixed set of charts
- [ ] Cross-board (workspace) dashboard for admins
- [ ] Charts: cards per list, cards per member, cards by priority, completion-rate trend
- [ ] Date-range picker

## Implementation notes
- Backend: aggregation queries; consider caching with `daily_board_snapshots(board_id, date, list_counts_json, ...)` for fast trends
- Frontend: Recharts or Visx components

<!-- labels: P2,feature,backend,frontend,area:platform -->

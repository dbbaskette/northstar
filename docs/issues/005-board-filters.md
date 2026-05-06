# Add advanced board filters

## Problem
On large boards, users need to focus on a slice — their cards, overdue cards, a label. Without filters they scroll past everything.

## Acceptance criteria
- [ ] Filter panel toggle in board header
- [ ] Filter by: assignee, label, priority, due date range, completion state, free-text in title
- [ ] Multiple filters combine with AND; multi-select within a category combines with OR
- [ ] Filtered state encoded in URL (`?assignee=...&label=...`) — shareable
- [ ] Active filters shown as removable chips
- [ ] "Clear all" resets

## Implementation notes
- DB: none (client-side filter over `useBoard()` cache)
- Frontend: `BoardFilters.tsx`, URL state via `useSearchParams`; pass filtered card set to `BoardView`

<!-- labels: P0,feature,frontend,area:boards -->

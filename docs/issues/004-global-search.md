# Add global search across cards and boards

## Problem
With many boards and cards, finding work without scrolling is essential. There is currently no search at all.

## Acceptance criteria
- [ ] Top-bar search input + `Cmd/Ctrl+K` shortcut opens a search modal
- [ ] Search matches card title, description, comment bodies, label names
- [ ] Results grouped by board with counts
- [ ] Filter chips: board, member, label, has-due-date, completed
- [ ] Keyboard navigation (arrow keys + Enter to open)
- [ ] Per-board search variant available from the board header

## Implementation notes
- DB: PostgreSQL `tsvector` columns + `GIN` indexes on `cards.title || description`, `card_comments.body`, `labels.name`; trigger to keep tsvector in sync
- Backend: `GET /search?q=...&board_id=...&limit=...` returning grouped results
- Frontend: `SearchModal.tsx` with portal mount; debounced query

<!-- labels: P0,feature,backend,frontend,area:search -->

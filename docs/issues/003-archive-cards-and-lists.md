# Archive cards and lists with restore

## Problem
Cards already soft-delete (`deleted_at`), but there is no UI to view archived items or restore them. Lists can only be archived, not restored. Teams need a "second-chance bin" to keep boards clean without losing history.

## Acceptance criteria
- [ ] "Archived items" panel in board menu showing archived cards and lists
- [ ] Restore action returns the item to its previous list/position (or top of board for restored lists)
- [ ] Permanently delete is a separate explicit action with confirmation
- [ ] Archived items excluded from search by default; filter to include them

## Implementation notes
- DB: `cards.deleted_at` already exists; add `lists.archived_at`, `archived_by` (also for cards)
- Backend: `GET /boards/:id/archived`, `POST /cards/:id/restore`, `POST /lists/:id/restore`, `DELETE /cards/:id/permanent`
- Frontend: `ArchivedPanel.tsx` opened from board header

<!-- labels: P0,feature,backend,frontend,area:boards -->

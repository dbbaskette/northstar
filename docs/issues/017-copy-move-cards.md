# Copy and move cards across lists/boards

## Problem
Reorganizing work today means recreating cards by hand. Copy preserves work; move keeps a card's history when its home should change.

## Acceptance criteria
- [ ] Card menu actions: Copy, Move
- [ ] Copy options: include description, checklists, attachments, comments, labels, members (each toggleable)
- [ ] Move target = any list on any board the user has access to
- [ ] On move across boards, labels are remapped by name (or dropped) — surface a warning

## Implementation notes
- Service-layer transactional clone in `internal/service/card_service.go`
- New routes: `POST /cards/:id/copy`, `POST /cards/:id/move-to`
- Frontend: target picker modal with board → list cascade

<!-- labels: P1,feature,backend,frontend,area:cards -->

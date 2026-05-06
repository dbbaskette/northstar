# Copy lists and boards

## Problem
Repeatable workflows benefit from cloning a list (with its cards) or a whole board. Foundational for templates (issue 021).

## Acceptance criteria
- [ ] List menu action "Copy list" — clones list with all non-archived cards, preserving order
- [ ] Board menu action "Copy board" — clones board with lists, cards, labels (not comments/activity)
- [ ] Copied items get fresh IDs, timestamps, and `created_by = current user`

## Implementation notes
- Service-layer deep copy in `service/board_service.go`
- Routes: `POST /lists/:id/copy`, `POST /boards/:id/copy`
- Frontend: name-prompt modal

<!-- labels: P1,feature,backend,frontend,area:boards -->

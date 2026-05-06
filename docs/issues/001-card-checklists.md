# Add card checklists

## Problem
Cards need finer-grained subtasks. Today, splitting work means creating extra cards and losing the parent context. Trello-style checklists let users track many small items inside one card with a visible progress indicator.

## Acceptance criteria
- [ ] A card can have one or more named checklists
- [ ] Each checklist has ordered items that can be checked/unchecked
- [ ] Items can have an optional due date and assignee
- [ ] Completion progress (`3/8`) is visible on the card thumbnail
- [ ] Reordering items via drag-and-drop within a checklist
- [ ] Activity log + WS broadcast on item check/uncheck

## Implementation notes
- DB: `checklists(id, card_id, title, position)`, `checklist_items(id, checklist_id, text, is_complete, position, due_date NULL, assignee_id NULL)`
- Repo + handler under `internal/repository/checklist_repo.go`, `internal/handler/checklist.go`
- Frontend: section in `CardModal.tsx`, badge on `CardItem.tsx`

<!-- labels: P0,feature,backend,frontend,area:cards -->

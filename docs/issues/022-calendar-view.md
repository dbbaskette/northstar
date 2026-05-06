# Calendar view

## Problem
Editorial, ops, and any deadline-driven team need to see cards on a calendar to spot conflicts and plan ahead.

## Acceptance criteria
- [ ] Toggle between Board / Calendar views in board header
- [ ] Month and week views; cards rendered on their `due_date`
- [ ] Drag a card to a new date to update `due_date`
- [ ] Color-code by list, priority, or label (user choice)

## Implementation notes
- Frontend: FullCalendar or `react-big-calendar`; consume the same `useBoard` data
- Backend: no schema changes; existing `due_date` is sufficient
- Mutation: existing `PATCH /cards/:id` with new `due_date`

<!-- labels: P1,feature,frontend,area:boards -->

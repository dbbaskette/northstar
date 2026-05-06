# Timeline / Gantt view

## Problem
Project planning needs cards visualized as bars on a timeline with dependencies. A Kanban board hides scheduling concerns.

## Acceptance criteria
- [ ] Timeline view showing cards with start + end (due) dates as horizontal bars
- [ ] Drag bars to adjust dates; drag edges to resize
- [ ] Define "blocks" relationships between cards; render as arrows
- [ ] Color-code by list, label, or assignee

## Implementation notes
- DB: add `start_date` to cards; `card_dependencies(id, blocker_card_id, blocked_card_id, type)`
- Frontend: SVG-based timeline (e.g., `react-gantt-task` or custom); separate page route
- Depends on: issue 022 (calendar establishes date-driven views)

<!-- labels: P2,feature,backend,frontend,area:boards -->

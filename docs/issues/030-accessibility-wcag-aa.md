# Meet WCAG 2.2 AA accessibility

## Problem
Drag-and-drop is keyboard-inaccessible by default. Color-only meaning (priority colors, label colors) excludes color-blind users. Procurement processes for some teams require WCAG AA.

## Acceptance criteria
- [ ] Visible focus indicators on all interactive elements
- [ ] Drag-and-drop works via keyboard with screen-reader announcements
- [ ] Color contrast ratios meet AA (4.5:1 for text, 3:1 for large text and icons)
- [ ] No information conveyed by color alone (priority, label name visible without color)
- [ ] All form fields have associated labels
- [ ] Audited with axe-core CI check passing

## Implementation notes
- Frontend: dnd-kit's `KeyboardSensor` is already enabled — needs announcer setup
- Add `react-aria` primitives where helpful
- CI: add `@axe-core/playwright` or similar in test workflow

<!-- labels: P1,feature,frontend,area:platform -->

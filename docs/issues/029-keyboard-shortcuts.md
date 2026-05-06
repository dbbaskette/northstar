# Keyboard shortcuts

## Problem
Power users move much faster with the keyboard. Without shortcuts, every action requires a mouse trip.

## Acceptance criteria
- [ ] Global: `?` opens help, `Cmd/Ctrl+K` search, `g d` go to dashboard, `Esc` close modals
- [ ] Board: `n` new card on hovered list, `f` filters, `c` archive selected card
- [ ] Card modal: `e` edit description, `d` due date, `l` labels, `m` members, `Enter` to confirm
- [ ] Shortcuts disabled inside text inputs
- [ ] Cheat sheet shown via `?`

## Implementation notes
- Frontend: a `useHotkeys` wrapper around `react-hotkeys-hook`; context-aware (board vs modal)
- No backend changes

<!-- labels: P1,feature,frontend,area:platform -->

# Make the app fully mobile responsive

## Problem
The board view is currently designed for desktop. On phones the sidebar overlaps content, lists don't scroll well, and drag-and-drop can't work via touch.

## Acceptance criteria
- [ ] Sidebar collapses to a hamburger menu on `<sm` breakpoints
- [ ] Board view scrolls horizontally with snap points to lists
- [ ] Cards are tap-to-open; drag works via long-press touch sensor
- [ ] Card modal becomes a full-screen sheet on mobile
- [ ] All interactive elements meet minimum 44×44 touch target
- [ ] Tested on iOS Safari + Android Chrome at 360px and 414px

## Implementation notes
- dnd-kit already supports `TouchSensor` — just needs activation in `BoardView`
- Tailwind responsive prefix audit; possibly `useMediaQuery` for layout switches
- Sidebar refactor to a `<Drawer>` component on mobile

<!-- labels: P0,feature,frontend,area:platform -->

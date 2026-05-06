# Add dark mode

## Problem
The app is light-mode only. Many users prefer dark mode at night and on devices that follow the system theme.

## Acceptance criteria
- [ ] User setting: Light / Dark / System (default System)
- [ ] Toggle in header user menu
- [ ] Setting persists per user
- [ ] All views (auth, dashboard, board, modals) themed in dark mode
- [ ] Board background colors remain user-chosen but text contrast adapts

## Implementation notes
- DB: `users.theme_preference VARCHAR(10)` ('light'|'dark'|'system')
- Frontend: Tailwind `dark:` classes; theme provider reading user pref + `prefers-color-scheme`
- Audit each component once; add tokens for surface/foreground/border

<!-- labels: P0,feature,frontend,area:platform -->

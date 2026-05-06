# User profiles with avatar uploads

## Problem
Users currently have only an email and display name. Avatars across cards, comments, and member pickers fall back to initials only. A profile page lets users set context (avatar, timezone, bio).

## Acceptance criteria
- [ ] Profile settings page with editable display name, avatar, bio, timezone
- [ ] Avatar upload with crop UI; rendered everywhere users appear
- [ ] Initials fallback with deterministic color hashing
- [ ] Timezone respected in due-date display

## Implementation notes
- DB: `users.avatar_url`, `users.bio`, `users.timezone` (already partially exists)
- Storage: same S3 abstraction as attachments (issue 002) — image path
- Frontend: `ProfilePage.tsx`, `Avatar.tsx` reusable component

<!-- labels: P0,feature,backend,frontend,area:users,needs:storage -->

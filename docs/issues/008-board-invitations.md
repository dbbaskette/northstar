# Add board invitations via link or email

## Problem
Currently, members can be added only by user_id via API. There's no end-user invite flow — admins can't onboard a colleague without manual steps.

## Acceptance criteria
- [ ] "Invite" button in board header opens a modal
- [ ] Generate a shareable invite link with role + optional expiry
- [ ] Invite by email — sends a link the recipient clicks to join
- [ ] Pending invites list with revoke
- [ ] Accepting an invite when not signed in redirects through register/login then joins

## Implementation notes
- DB: `board_invites(id, board_id, token, email NULL, role, expires_at, created_by, accepted_at NULL, accepted_by_user_id NULL)`
- Backend: `POST /boards/:id/invites`, `GET /invites/:token`, `POST /invites/:token/accept`
- Email: requires SMTP integration (see needs:email)
- Frontend: `InviteModal.tsx`, `AcceptInvitePage.tsx`

<!-- labels: P0,feature,backend,frontend,area:collaboration,needs:email -->

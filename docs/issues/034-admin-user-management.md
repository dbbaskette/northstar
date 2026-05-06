# Admin user management

## Problem
Roles exist but admins have no UI to list users, change roles in bulk, deactivate departed colleagues, or transfer board ownership.

## Acceptance criteria
- [ ] Admin "Users" page with paginated list
- [ ] Bulk role change
- [ ] Deactivate (soft) and reactivate users
- [ ] Force password reset (or revoke sessions)
- [ ] Transfer board ownership when a user leaves

## Implementation notes
- DB: `users.is_active`, `users.deactivated_at`
- Backend: routes under `/admin/users`; gated by user role = admin
- Frontend: `AdminUsersPage.tsx`

<!-- labels: P1,feature,backend,frontend,area:admin -->

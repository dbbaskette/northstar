# Workspace-level audit logs

## Problem
Activity logs are functional ("X moved a card"). Security-relevant events (logins, role changes, permission changes, deletions, exports) need a separate, append-only, admin-only audit trail.

## Acceptance criteria
- [ ] Append-only audit log table — no UPDATE/DELETE allowed
- [ ] Records: actor user, action, target, IP, user agent, timestamp, metadata
- [ ] Admin-only viewer with filters (actor, action type, date range)
- [ ] CSV export

## Implementation notes
- DB: `audit_log(id, workspace_id, actor_user_id, action, target_type, target_id, ip, user_agent, metadata_json, created_at)` — no triggers that update; revoke UPDATE/DELETE at DB-role level
- Backend: middleware that records on auth + permission-change endpoints
- Frontend: `AdminAuditLog.tsx`

<!-- labels: P1,feature,backend,frontend,area:admin -->

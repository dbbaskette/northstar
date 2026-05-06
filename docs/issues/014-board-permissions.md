# Add per-board permissions and visibility

## Problem
Today, board access is determined entirely by team membership. Teams need finer control: a leadership-only board within a workspace, or a read-only shared link.

## Acceptance criteria
- [ ] Board has a visibility setting: Private / Workspace / Link
- [ ] Private boards have an explicit member list (subset of team)
- [ ] Per-member role on the board: admin, member, viewer
- [ ] Shareable read-only link with optional expiry
- [ ] Existing role-based handler checks updated to consult board membership when visibility = Private

## Implementation notes
- DB: `boards.visibility ENUM('private','workspace','link')`; `board_members` table already exists, extend it; `board_share_links(id, board_id, token, role, expires_at)`
- Backend: refactor permission check helper used by board/list/card handlers
- Frontend: `BoardSharingModal.tsx`

<!-- labels: P0,feature,backend,frontend,area:permissions -->

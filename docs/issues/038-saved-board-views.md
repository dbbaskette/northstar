# Saved board views

## Problem
Re-applying the same filters every session is tedious. Power users want named views to switch contexts in one click.

## Acceptance criteria
- [ ] Save current filter combination as a named view
- [ ] Switch between views from a dropdown in the board header
- [ ] Optional "shared" flag — view visible to all board members
- [ ] Default view per user

## Implementation notes
- DB: `board_views(id, board_id, user_id, name, filter_json, is_shared, created_at)`
- Depends on: issue 005 (board filters)

<!-- labels: P2,feature,backend,frontend,area:boards -->

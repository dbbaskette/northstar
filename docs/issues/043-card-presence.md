# Real-time card presence indicators

## Problem
When two users edit the same card, they don't know about each other and lose work to last-write-wins. Showing presence reduces conflict and feels collaborative.

## Acceptance criteria
- [ ] Stacked avatars in card modal header showing who is currently viewing
- [ ] On the board, indicator on cards with active viewers
- [ ] Updates within 1-2 seconds of join/leave

## Implementation notes
- Ephemeral via WebSocket presence channels; no persistence
- Backend: extend `internal/ws/hub.go` with per-card presence tracking
- Frontend: `usePresence(targetType, targetId)` hook

<!-- labels: P2,feature,backend,frontend,area:collaboration -->

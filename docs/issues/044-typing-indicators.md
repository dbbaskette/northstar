# Typing indicators in comments

## Problem
Standard "X is typing…" cue prevents two people writing the same answer. Small UX win.

## Acceptance criteria
- [ ] When a user is typing in a comment input, others see "X is typing…"
- [ ] Indicator clears after 5 seconds of no input or on submit
- [ ] Multiple typers shown as "X and Y are typing…"

## Implementation notes
- Ephemeral WebSocket events
- Frontend: debounced "typing" emit on keystroke

<!-- labels: P2,feature,backend,frontend,area:collaboration -->

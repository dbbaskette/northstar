# Card voting

## Problem
Retros and prioritization meetings benefit from "vote on what matters" without comment spam.

## Acceptance criteria
- [ ] Members can upvote any card
- [ ] Vote count visible on card thumbnail
- [ ] Sort lists by vote count

## Implementation notes
- DB: `card_votes(card_id, user_id, created_at)` PK on (card_id, user_id)
- Backend: `POST/DELETE /cards/:id/vote`
- Frontend: vote button; sort option in list header

<!-- labels: P2,feature,backend,frontend,area:cards -->

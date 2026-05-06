# Add emoji reactions on comments

## Problem
"+1" or 👍 reply comments add noise. Reactions consolidate sentiment without spamming threads.

## Acceptance criteria
- [ ] Hover-reveal reaction picker on each comment
- [ ] Common reactions: 👍 ❤️ 🎉 😄 😕 👎
- [ ] Click toggles user's reaction; multiple users can react with the same emoji
- [ ] Reactions counted per emoji and shown inline with reactor avatars on hover

## Implementation notes
- DB: `comment_reactions(comment_id, user_id, emoji)` PK on all three
- Backend: `POST/DELETE /comments/:id/reactions/:emoji`
- Frontend: reaction bar on comment

<!-- labels: P1,feature,backend,frontend,area:cards -->

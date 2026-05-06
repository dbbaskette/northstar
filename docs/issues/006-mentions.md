# Add @mentions in comments and descriptions

## Problem
Users need to address teammates directly inside cards. Today there is no way to flag a comment for someone specific.

## Acceptance criteria
- [ ] Typing `@` in a comment or description shows an autocomplete dropdown of board members
- [ ] Selecting a member inserts a `@username` token rendered as a styled pill
- [ ] Saving the comment/description triggers a notification to each mentioned user
- [ ] Mentions persist as part of the body and re-render on load

## Implementation notes
- DB: parse mentions on save; emits via the notifications system (issue 007)
- Backend: shared parser `internal/service/mentions.go` extracting `@username` against board members
- Frontend: TipTap or Lexical mention extension; needs board members list available in card modal

<!-- labels: P0,feature,backend,frontend,area:collaboration -->

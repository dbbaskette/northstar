# Card relationships (linked / duplicates)

## Problem
Cards across boards often relate ("duplicate of", "related to", "blocks"). Without explicit relationships, deduplication and cross-references happen in comments and rot.

## Acceptance criteria
- [ ] Add relationship from a card: pick another card and a relation type
- [ ] Relations are bidirectional in display (X blocks Y → Y is blocked by X)
- [ ] Linked cards section in card modal
- [ ] Relations persist across boards

## Implementation notes
- DB: `card_links(id, from_card_id, to_card_id, relation_type)`; reuse `card_dependencies` from issue 039 if relation includes "blocks"
- Backend: routes under `/cards/:id/links`

<!-- labels: P2,feature,backend,frontend,area:cards -->

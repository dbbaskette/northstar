# Card cover images

## Problem
Visual scannability of design and content boards depends on cover imagery. Today every card looks the same.

## Acceptance criteria
- [ ] Card can have a cover: image attachment or solid color
- [ ] Two sizes: half (banner) and full (image fills the thumbnail)
- [ ] Auto-suggest first image attachment as cover
- [ ] Quick "Cover" picker in card modal

## Implementation notes
- DB: extend `cards` with `cover_attachment_id NULL`, `cover_color VARCHAR(20) NULL`, `cover_size ENUM('half','full') NULL`
- Frontend: render in `CardItem.tsx`; picker in `CardModal.tsx`
- Depends on: issue 002 (attachments)

<!-- labels: P1,feature,backend,frontend,area:cards -->

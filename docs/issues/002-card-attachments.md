# Add card attachments (files + URLs)

## Problem
Users frequently need to attach screenshots, PDFs, design files, or external links to cards. Without attachments, related context is lost in chat or email.

## Acceptance criteria
- [ ] Upload files via drag-and-drop or file picker on the card modal
- [ ] Image attachments render inline thumbnails
- [ ] URL attachments stored as named links with favicon
- [ ] Per-attachment delete (uploader or admin only)
- [ ] Configurable max size + MIME allowlist; reject silently disabled
- [ ] Attachment count badge on card thumbnail

## Implementation notes
- DB: `attachments(id, card_id, uploader_id, kind ENUM('file','url'), filename, mime, size_bytes, storage_key, url, created_at)`
- Storage: S3-compatible (MinIO for self-hosted); presigned URLs for upload/download
- Backend: `internal/storage/` package abstracting S3; new handler routes
- Frontend: drag-drop zone in `CardModal.tsx`; thumbnail rendering helper

<!-- labels: P0,feature,backend,frontend,area:cards,needs:storage -->

package models

import (
	"time"

	"github.com/jackc/pgx/v5/pgtype"
)

type Attachment struct {
	ID         pgtype.UUID `json:"id"`
	CardID     pgtype.UUID `json:"card_id"`
	UploaderID pgtype.UUID `json:"uploader_id"`
	Kind       string      `json:"kind"`
	Filename   string      `json:"filename"`
	MimeType   pgtype.Text `json:"mime_type,omitempty"`
	SizeBytes  pgtype.Int8 `json:"size_bytes,omitempty"`
	StorageKey pgtype.Text `json:"-"`
	URL        pgtype.Text `json:"url,omitempty"`
	CreatedAt  time.Time   `json:"created_at"`
}

package models

import (
	"time"

	"github.com/jackc/pgx/v5/pgtype"
)

// CustomFieldValue mirrors repository.CustomFieldValue but in models so
// it's importable without a cycle. Populated on card detail responses.
type CustomFieldValue struct {
	FieldDefID string  `json:"field_def_id"`
	Text       string  `json:"value_text,omitempty"`
	Number     float64 `json:"value_number,omitempty"`
	Date       string  `json:"value_date,omitempty"`
	Bool       bool    `json:"value_bool,omitempty"`
}

type Card struct {
	ID                pgtype.UUID        `json:"id"`
	ListID            pgtype.UUID        `json:"list_id"`
	Title             string             `json:"title"`
	Description       pgtype.Text        `json:"description,omitempty"`
	Position          float64            `json:"position"`
	Priority          pgtype.Text        `json:"priority,omitempty"`
	StartDate         pgtype.Timestamptz `json:"start_date,omitempty"`
	DueDate           pgtype.Timestamptz `json:"due_date,omitempty"`
	CompletedAt       pgtype.Timestamptz `json:"completed_at,omitempty"`
	CoverAttachmentID pgtype.UUID        `json:"cover_attachment_id,omitempty"`
	CoverColor        pgtype.Text        `json:"cover_color,omitempty"`
	CoverSize         pgtype.Text        `json:"cover_size,omitempty"`
	IsArchived        bool               `json:"is_archived"`
	CreatedBy         pgtype.UUID        `json:"created_by"`
	CreatedAt         time.Time          `json:"created_at"`
	UpdatedAt         time.Time          `json:"updated_at"`
	DeletedAt         pgtype.Timestamptz `json:"deleted_at,omitempty"`
	Labels            []Label            `json:"labels,omitempty"`
	Assignees         []User             `json:"assignees,omitempty"`
	Comments          []Comment          `json:"comments,omitempty"`
	Checklists        []Checklist        `json:"checklists,omitempty"`
	Attachments       []Attachment       `json:"attachments,omitempty"`
	CustomFields      []CustomFieldValue `json:"custom_fields,omitempty"`

	// Aggregate counts (used on the board view, not the full card detail)
	ChecklistTotal  int  `json:"checklist_total,omitempty"`
	ChecklistDone   int  `json:"checklist_done,omitempty"`
	AttachmentCount int  `json:"attachment_count,omitempty"`
	VoteCount       int  `json:"vote_count"`
	ViewerVoted     bool `json:"viewer_voted"`
}

package models

import (
	"time"

	"github.com/jackc/pgx/v5/pgtype"
)

type Card struct {
	ID          pgtype.UUID        `json:"id"`
	ListID      pgtype.UUID        `json:"list_id"`
	Title       string             `json:"title"`
	Description pgtype.Text        `json:"description,omitempty"`
	Position    float64            `json:"position"`
	Priority    pgtype.Text        `json:"priority,omitempty"`
	DueDate     pgtype.Timestamptz `json:"due_date,omitempty"`
	CompletedAt pgtype.Timestamptz `json:"completed_at,omitempty"`
	IsArchived  bool               `json:"is_archived"`
	CreatedBy   pgtype.UUID        `json:"created_by"`
	CreatedAt   time.Time          `json:"created_at"`
	UpdatedAt   time.Time          `json:"updated_at"`
	DeletedAt   pgtype.Timestamptz `json:"deleted_at,omitempty"`
	Labels      []Label            `json:"labels,omitempty"`
	Assignees   []User             `json:"assignees,omitempty"`
	Comments    []Comment          `json:"comments,omitempty"`
	Checklists  []Checklist        `json:"checklists,omitempty"`

	// Aggregate counts (used on the board view, not the full card detail)
	ChecklistTotal int `json:"checklist_total,omitempty"`
	ChecklistDone  int `json:"checklist_done,omitempty"`
}

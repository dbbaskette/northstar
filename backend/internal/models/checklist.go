package models

import (
	"time"

	"github.com/jackc/pgx/v5/pgtype"
)

type Checklist struct {
	ID        pgtype.UUID     `json:"id"`
	CardID    pgtype.UUID     `json:"card_id"`
	Title     string          `json:"title"`
	Position  float64         `json:"position"`
	CreatedAt time.Time       `json:"created_at"`
	UpdatedAt time.Time       `json:"updated_at"`
	Items     []ChecklistItem `json:"items,omitempty"`
}

type ChecklistItem struct {
	ID           pgtype.UUID        `json:"id"`
	ChecklistID  pgtype.UUID        `json:"checklist_id"`
	Text         string             `json:"text"`
	IsComplete   bool               `json:"is_complete"`
	Position     float64            `json:"position"`
	DueDate      pgtype.Timestamptz `json:"due_date,omitempty"`
	AssigneeID   pgtype.UUID        `json:"assignee_id,omitempty"`
	CreatedAt    time.Time          `json:"created_at"`
	UpdatedAt    time.Time          `json:"updated_at"`
}

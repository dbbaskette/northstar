package models

import (
	"time"

	"github.com/jackc/pgx/v5/pgtype"
)

type Board struct {
	ID          pgtype.UUID        `json:"id"`
	TeamID      pgtype.UUID        `json:"team_id"`
	Name        string             `json:"name"`
	Description pgtype.Text        `json:"description,omitempty"`
	Background  string             `json:"background"`
	IsArchived  bool               `json:"is_archived"`
	CreatedBy   pgtype.UUID        `json:"created_by"`
	CreatedAt   time.Time          `json:"created_at"`
	UpdatedAt   time.Time          `json:"updated_at"`
	DeletedAt   pgtype.Timestamptz `json:"deleted_at,omitempty"`
	Lists       []List             `json:"lists,omitempty"`
	Labels      []Label            `json:"labels,omitempty"`
}

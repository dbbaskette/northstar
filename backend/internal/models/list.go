package models

import (
	"time"

	"github.com/jackc/pgx/v5/pgtype"
)

type List struct {
	ID         pgtype.UUID `json:"id"`
	BoardID    pgtype.UUID `json:"board_id"`
	Name       string      `json:"name"`
	Position   float64     `json:"position"`
	IsArchived bool        `json:"is_archived"`
	CreatedAt  time.Time   `json:"created_at"`
	UpdatedAt  time.Time   `json:"updated_at"`
	Cards      []Card      `json:"cards,omitempty"`
}

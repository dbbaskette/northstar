package models

import (
	"time"

	"github.com/jackc/pgx/v5/pgtype"
)

type Label struct {
	ID        pgtype.UUID `json:"id"`
	BoardID   pgtype.UUID `json:"board_id"`
	Name      string      `json:"name"`
	Color     string      `json:"color"`
	CreatedAt time.Time   `json:"created_at"`
}

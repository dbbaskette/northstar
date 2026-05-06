package models

import (
	"time"

	"github.com/jackc/pgx/v5/pgtype"
)

type Activity struct {
	ID         pgtype.UUID `json:"id"`
	BoardID    pgtype.UUID `json:"board_id"`
	UserID     pgtype.UUID `json:"user_id"`
	Action     string      `json:"action"`
	EntityType string      `json:"entity_type"`
	EntityID   pgtype.UUID `json:"entity_id"`
	Metadata   []byte      `json:"metadata,omitempty"`
	CreatedAt  time.Time   `json:"created_at"`
	User       *User       `json:"user,omitempty"`
}

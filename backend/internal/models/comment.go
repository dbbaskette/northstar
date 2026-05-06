package models

import (
	"time"

	"github.com/jackc/pgx/v5/pgtype"
)

type Comment struct {
	ID        pgtype.UUID `json:"id"`
	CardID    pgtype.UUID `json:"card_id"`
	UserID    pgtype.UUID `json:"user_id"`
	Body      string      `json:"body"`
	CreatedAt time.Time   `json:"created_at"`
	UpdatedAt time.Time   `json:"updated_at"`
	User      *User       `json:"user,omitempty"`
}

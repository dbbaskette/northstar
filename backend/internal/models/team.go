package models

import (
	"time"

	"github.com/jackc/pgx/v5/pgtype"
)

type Team struct {
	ID          pgtype.UUID `json:"id"`
	Name        string      `json:"name"`
	Description pgtype.Text `json:"description,omitempty"`
	CreatedBy   pgtype.UUID `json:"created_by"`
	CreatedAt   time.Time   `json:"created_at"`
	UpdatedAt   time.Time   `json:"updated_at"`
}

type TeamMember struct {
	TeamID   pgtype.UUID `json:"team_id"`
	UserID   pgtype.UUID `json:"user_id"`
	Role     string      `json:"role"`
	JoinedAt time.Time   `json:"joined_at"`
	User     *User       `json:"user,omitempty"`
}

package models

import (
	"time"

	"github.com/jackc/pgx/v5/pgtype"
)

type User struct {
	ID           pgtype.UUID        `json:"id"`
	Email        string             `json:"email"`
	Username     string             `json:"username"`
	PasswordHash string             `json:"-"`
	DisplayName  string             `json:"display_name"`
	AvatarURL    pgtype.Text        `json:"avatar_url,omitempty"`
	Role         string             `json:"role"`
	CreatedAt    time.Time          `json:"created_at"`
	UpdatedAt    time.Time          `json:"updated_at"`
}

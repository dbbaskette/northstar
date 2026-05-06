package repository

import (
	"context"
	"encoding/json"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/dbbaskette/northstar/internal/models"
)

type ActivityRepo struct {
	pool *pgxpool.Pool
}

func NewActivityRepo(pool *pgxpool.Pool) *ActivityRepo {
	return &ActivityRepo{pool: pool}
}

func (r *ActivityRepo) Log(ctx context.Context, boardID, userID, action, entityType, entityID string, metadata interface{}) error {
	var meta []byte
	if metadata != nil {
		var err error
		meta, err = json.Marshal(metadata)
		if err != nil {
			return err
		}
	}

	const q = `
		INSERT INTO activity_log (board_id, user_id, action, entity_type, entity_id, metadata)
		VALUES ($1, $2, $3, $4, $5, $6)`

	_, err := r.pool.Exec(ctx, q, boardID, userID, action, entityType, entityID, meta)
	return err
}

func (r *ActivityRepo) ListByBoard(ctx context.Context, boardID string, limit int) ([]models.Activity, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	const q = `
		SELECT a.id, a.board_id, a.user_id, a.action, a.entity_type, a.entity_id, a.metadata, a.created_at,
		       u.id, u.email, u.username, u.display_name, u.avatar_url, u.role
		FROM activity_log a
		JOIN users u ON a.user_id = u.id
		WHERE a.board_id = $1
		ORDER BY a.created_at DESC
		LIMIT $2`

	rows, err := r.pool.Query(ctx, q, boardID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var activities []models.Activity
	for rows.Next() {
		var a models.Activity
		u := &models.User{}
		if err := rows.Scan(
			&a.ID, &a.BoardID, &a.UserID, &a.Action, &a.EntityType, &a.EntityID, &a.Metadata, &a.CreatedAt,
			&u.ID, &u.Email, &u.Username, &u.DisplayName, &u.AvatarURL, &u.Role,
		); err != nil {
			return nil, err
		}
		a.User = u
		activities = append(activities, a)
	}
	return activities, rows.Err()
}

package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

type WatcherRepo struct {
	pool *pgxpool.Pool
}

func NewWatcherRepo(pool *pgxpool.Pool) *WatcherRepo {
	return &WatcherRepo{pool: pool}
}

// Watch adds (or no-ops) a watch row.
func (r *WatcherRepo) Watch(ctx context.Context, userID, targetType, targetID string) error {
	if !validTargetType(targetType) {
		return fmt.Errorf("invalid target_type: %s", targetType)
	}
	_, err := r.pool.Exec(ctx, `
		INSERT INTO watchers (user_id, target_type, target_id) VALUES ($1, $2::watch_target, $3)
		ON CONFLICT DO NOTHING`,
		userID, targetType, targetID)
	return err
}

// Unwatch removes the watch row if it exists.
func (r *WatcherRepo) Unwatch(ctx context.Context, userID, targetType, targetID string) error {
	if !validTargetType(targetType) {
		return fmt.Errorf("invalid target_type: %s", targetType)
	}
	_, err := r.pool.Exec(ctx,
		`DELETE FROM watchers WHERE user_id = $1 AND target_type = $2::watch_target AND target_id = $3`,
		userID, targetType, targetID)
	return err
}

// IsWatching returns true if the user is watching the target.
func (r *WatcherRepo) IsWatching(ctx context.Context, userID, targetType, targetID string) (bool, error) {
	var n int
	err := r.pool.QueryRow(ctx,
		`SELECT COUNT(*)::int FROM watchers WHERE user_id = $1 AND target_type = $2::watch_target AND target_id = $3`,
		userID, targetType, targetID).Scan(&n)
	return n > 0, err
}

// WatchersForCard returns user_ids that should be notified about card events.
// Includes direct card watchers, list watchers, and board watchers.
func (r *WatcherRepo) WatchersForCard(ctx context.Context, cardID string) ([]string, error) {
	const q = `
		SELECT DISTINCT w.user_id::text
		FROM cards c
		JOIN lists l ON c.list_id = l.id
		JOIN watchers w ON
			(w.target_type = 'card' AND w.target_id = c.id) OR
			(w.target_type = 'list' AND w.target_id = c.list_id) OR
			(w.target_type = 'board' AND w.target_id = l.board_id)
		WHERE c.id = $1`

	rows, err := r.pool.Query(ctx, q, cardID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out = append(out, id)
	}
	return out, rows.Err()
}

// WatchersForBoard returns user_ids watching the board itself (used for
// board-level events like "card.created" so list/board watchers learn
// about new cards).
func (r *WatcherRepo) WatchersForBoard(ctx context.Context, boardID string) ([]string, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT user_id::text FROM watchers WHERE target_type = 'board' AND target_id = $1`,
		boardID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out = append(out, id)
	}
	return out, rows.Err()
}

func validTargetType(t string) bool {
	switch t {
	case "card", "list", "board":
		return true
	}
	return false
}

package repository

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// WorkItem is one card the viewer cares about, with the board/list
// context joined in so the frontend can render it without N+1
// follow-ups. `reason` is a comma-separated list when a card hits
// multiple buckets (assigned + watching, etc.).
type WorkItem struct {
	CardID      string     `json:"card_id"`
	Title       string     `json:"title"`
	ListID      string     `json:"list_id"`
	ListName    string     `json:"list_name"`
	BoardID     string     `json:"board_id"`
	BoardName   string     `json:"board_name"`
	Priority    *string    `json:"priority,omitempty"`
	DueDate     *time.Time `json:"due_date,omitempty"`
	CompletedAt *time.Time `json:"completed_at,omitempty"`
	UpdatedAt   time.Time  `json:"updated_at"`
	Reasons     []string   `json:"reasons"`
}

type WorkRepo struct {
	pool *pgxpool.Pool
}

func NewWorkRepo(pool *pgxpool.Pool) *WorkRepo {
	return &WorkRepo{pool: pool}
}

// ForUser returns the union of:
//   - cards the user is assigned to (not archived, not deleted, not completed)
//   - cards the user watches via the `watchers` table
//   - cards on which the user has been @-mentioned (via comments table) in
//     the last `mentionLookbackDays` days
//
// Each bucket flag is reported in `reasons` so the frontend can group/
// filter without a second query.
func (r *WorkRepo) ForUser(ctx context.Context, userID string) ([]WorkItem, error) {
	const q = `
WITH base AS (
    SELECT c.id, c.title, c.list_id, c.priority, c.due_date, c.completed_at,
           c.updated_at, l.name AS list_name, l.board_id, b.name AS board_name
      FROM cards c
      JOIN lists l ON l.id = c.list_id AND l.is_archived = FALSE
      JOIN boards b ON b.id = l.board_id AND b.deleted_at IS NULL
     WHERE c.deleted_at IS NULL
       AND c.is_archived = FALSE
),
assigned AS (
    SELECT card_id FROM card_assignees WHERE user_id = $1::uuid
),
watching AS (
    SELECT target_id AS card_id FROM watchers
     WHERE user_id = $1::uuid AND target_type = 'card'
),
mentioned AS (
    SELECT DISTINCT cc.card_id
      FROM card_comments cc
      JOIN users u ON u.id = $1::uuid
     WHERE cc.body ~* ('@' || u.username || '\b')
       AND cc.created_at > NOW() - INTERVAL '14 days'
)
SELECT base.id::text, base.title, base.list_id::text, base.list_name,
       base.board_id::text, base.board_name,
       base.priority::text,
       base.due_date, base.completed_at, base.updated_at,
       (CASE WHEN assigned.card_id  IS NOT NULL THEN 'assigned'  END),
       (CASE WHEN watching.card_id  IS NOT NULL THEN 'watching'  END),
       (CASE WHEN mentioned.card_id IS NOT NULL THEN 'mentioned' END)
  FROM base
  LEFT JOIN assigned  ON assigned.card_id  = base.id
  LEFT JOIN watching  ON watching.card_id  = base.id
  LEFT JOIN mentioned ON mentioned.card_id = base.id
 WHERE assigned.card_id IS NOT NULL
    OR watching.card_id IS NOT NULL
    OR mentioned.card_id IS NOT NULL
 ORDER BY
    -- overdue first, then due-today, then due-this-week, then due-later, then undated
    CASE
      WHEN base.completed_at IS NOT NULL THEN 4
      WHEN base.due_date IS NULL          THEN 3
      WHEN base.due_date < NOW()          THEN 0
      WHEN base.due_date < NOW() + INTERVAL '7 days' THEN 1
      ELSE 2
    END,
    base.due_date NULLS LAST,
    base.updated_at DESC
 LIMIT 500`

	rows, err := r.pool.Query(ctx, q, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []WorkItem{}
	for rows.Next() {
		var it WorkItem
		var priority *string
		var assigned, watching, mentioned *string
		var due, completed *time.Time
		if err := rows.Scan(
			&it.CardID, &it.Title, &it.ListID, &it.ListName,
			&it.BoardID, &it.BoardName,
			&priority, &due, &completed, &it.UpdatedAt,
			&assigned, &watching, &mentioned,
		); err != nil {
			return nil, err
		}
		it.Priority = priority
		it.DueDate = due
		it.CompletedAt = completed
		if assigned != nil {
			it.Reasons = append(it.Reasons, *assigned)
		}
		if watching != nil {
			it.Reasons = append(it.Reasons, *watching)
		}
		if mentioned != nil {
			it.Reasons = append(it.Reasons, *mentioned)
		}
		out = append(out, it)
	}
	return out, rows.Err()
}

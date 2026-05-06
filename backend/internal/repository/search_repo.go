package repository

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

type SearchRepo struct {
	pool *pgxpool.Pool
}

func NewSearchRepo(pool *pgxpool.Pool) *SearchRepo {
	return &SearchRepo{pool: pool}
}

type SearchHit struct {
	CardID      string  `json:"card_id"`
	CardTitle   string  `json:"card_title"`
	CardDesc    string  `json:"card_description"`
	ListID      string  `json:"list_id"`
	ListName    string  `json:"list_name"`
	BoardID     string  `json:"board_id"`
	BoardName   string  `json:"board_name"`
	BoardColor  string  `json:"board_background"`
	TeamID      string  `json:"team_id"`
	TeamName    string  `json:"team_name"`
	Rank        float64 `json:"rank"`
	IsCompleted bool    `json:"is_completed"`
}

// Search runs a full-text search of cards across all boards the user has
// access to (via team membership). Returns top-N matches ordered by rank.
func (r *SearchRepo) Search(ctx context.Context, userID, query string, limit int) ([]SearchHit, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	const q = `
		SELECT c.id::text, c.title, COALESCE(c.description, ''), c.completed_at IS NOT NULL,
		       l.id::text, l.name,
		       b.id::text, b.name, b.background,
		       t.id::text, t.name,
		       ts_rank(c.search_vector, websearch_to_tsquery('english', $2)) AS rank
		FROM cards c
		JOIN lists l   ON c.list_id = l.id
		JOIN boards b  ON l.board_id = b.id
		JOIN teams t   ON b.team_id = t.id
		JOIN team_members tm ON tm.team_id = t.id
		WHERE tm.user_id = $1
		  AND c.deleted_at IS NULL
		  AND c.is_archived = FALSE
		  AND b.deleted_at IS NULL
		  AND l.is_archived = FALSE
		  AND c.search_vector @@ websearch_to_tsquery('english', $2)
		ORDER BY rank DESC, c.updated_at DESC
		LIMIT $3`

	rows, err := r.pool.Query(ctx, q, userID, query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var hits []SearchHit
	for rows.Next() {
		var h SearchHit
		if err := rows.Scan(
			&h.CardID, &h.CardTitle, &h.CardDesc, &h.IsCompleted,
			&h.ListID, &h.ListName,
			&h.BoardID, &h.BoardName, &h.BoardColor,
			&h.TeamID, &h.TeamName,
			&h.Rank,
		); err != nil {
			return nil, err
		}
		hits = append(hits, h)
	}
	return hits, rows.Err()
}

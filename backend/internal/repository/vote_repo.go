package repository

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

type VoteRepo struct {
	pool *pgxpool.Pool
}

func NewVoteRepo(pool *pgxpool.Pool) *VoteRepo {
	return &VoteRepo{pool: pool}
}

func (r *VoteRepo) Add(ctx context.Context, cardID, userID string) error {
	_, err := r.pool.Exec(ctx,
		`INSERT INTO card_votes (card_id, user_id) VALUES ($1, $2)
		 ON CONFLICT (card_id, user_id) DO NOTHING`,
		cardID, userID)
	return err
}

func (r *VoteRepo) Remove(ctx context.Context, cardID, userID string) error {
	_, err := r.pool.Exec(ctx,
		`DELETE FROM card_votes WHERE card_id = $1 AND user_id = $2`,
		cardID, userID)
	return err
}

// CountByCard counts votes for a single card.
func (r *VoteRepo) CountByCard(ctx context.Context, cardID string) (int, error) {
	var n int
	err := r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM card_votes WHERE card_id = $1`, cardID).Scan(&n)
	return n, err
}

// HasVoted reports whether the given user has voted on a card.
func (r *VoteRepo) HasVoted(ctx context.Context, cardID, userID string) (bool, error) {
	var exists bool
	err := r.pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM card_votes WHERE card_id = $1 AND user_id = $2)`,
		cardID, userID).Scan(&exists)
	return exists, err
}

// CountsForBoard returns vote counts and the viewer's voted-card set for
// every card on the board, in two map results — used to enrich the
// board payload without N+1 queries.
func (r *VoteRepo) CountsForBoard(ctx context.Context, boardID, userID string) (map[string]int, map[string]bool, error) {
	counts := map[string]int{}
	voted := map[string]bool{}

	rows, err := r.pool.Query(ctx, `
		SELECT cv.card_id::text, COUNT(*),
		       BOOL_OR(cv.user_id = $2::uuid) AS viewer_voted
		FROM card_votes cv
		JOIN cards c ON c.id = cv.card_id
		JOIN lists l ON l.id = c.list_id
		WHERE l.board_id = $1
		GROUP BY cv.card_id`, boardID, userID)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var id string
		var n int
		var vv bool
		if err := rows.Scan(&id, &n, &vv); err != nil {
			return nil, nil, err
		}
		counts[id] = n
		if vv {
			voted[id] = true
		}
	}
	return counts, voted, rows.Err()
}

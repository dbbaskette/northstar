package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/dbbaskette/northstar/internal/models"
)

type CommentRepo struct {
	pool *pgxpool.Pool
}

func NewCommentRepo(pool *pgxpool.Pool) *CommentRepo {
	return &CommentRepo{pool: pool}
}

func (r *CommentRepo) Create(ctx context.Context, c *models.Comment) error {
	const q = `
		INSERT INTO card_comments (card_id, user_id, body)
		VALUES ($1, $2, $3)
		RETURNING id, created_at, updated_at`

	return r.pool.QueryRow(ctx, q, c.CardID, c.UserID, c.Body).
		Scan(&c.ID, &c.CreatedAt, &c.UpdatedAt)
}

func (r *CommentRepo) Update(ctx context.Context, id, body string) error {
	ct, err := r.pool.Exec(ctx,
		`UPDATE card_comments SET body = $2 WHERE id = $1`, id, body)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return fmt.Errorf("comment not found")
	}
	return nil
}

// ToggleReaction adds the (comment, user, emoji) row if missing or
// removes it if present. Returns true if the reaction is now active.
func (r *CommentRepo) ToggleReaction(ctx context.Context, commentID, userID, emoji string) (bool, error) {
	ct, err := r.pool.Exec(ctx,
		`DELETE FROM comment_reactions WHERE comment_id = $1 AND user_id = $2 AND emoji = $3`,
		commentID, userID, emoji)
	if err != nil {
		return false, err
	}
	if ct.RowsAffected() > 0 {
		return false, nil
	}
	if _, err := r.pool.Exec(ctx,
		`INSERT INTO comment_reactions (comment_id, user_id, emoji) VALUES ($1, $2, $3)`,
		commentID, userID, emoji); err != nil {
		return false, err
	}
	return true, nil
}

// ReactionsByCardID returns reactions grouped by (comment_id, emoji)
// for every comment on a card. Used when populating the card detail.
func (r *CommentRepo) ReactionsByCardID(ctx context.Context, cardID string) (map[string][]models.CommentReaction, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT cr.comment_id::text, cr.emoji, array_agg(cr.user_id::text)::text[]
		FROM comment_reactions cr
		JOIN card_comments c ON cr.comment_id = c.id
		WHERE c.card_id = $1
		GROUP BY cr.comment_id, cr.emoji
		ORDER BY cr.emoji`, cardID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make(map[string][]models.CommentReaction)
	for rows.Next() {
		var (
			commentID string
			emoji     string
			userIDs   []string
		)
		if err := rows.Scan(&commentID, &emoji, &userIDs); err != nil {
			return nil, err
		}
		out[commentID] = append(out[commentID], models.CommentReaction{
			Emoji:   emoji,
			Count:   len(userIDs),
			UserIDs: userIDs,
		})
	}
	return out, rows.Err()
}

func (r *CommentRepo) Delete(ctx context.Context, id string) error {
	ct, err := r.pool.Exec(ctx, `DELETE FROM card_comments WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return fmt.Errorf("comment not found")
	}
	return nil
}

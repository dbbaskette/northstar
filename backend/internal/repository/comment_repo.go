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

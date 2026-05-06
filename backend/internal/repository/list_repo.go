package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/dbbaskette/northstar/internal/models"
)

type ListRepo struct {
	pool *pgxpool.Pool
}

func NewListRepo(pool *pgxpool.Pool) *ListRepo {
	return &ListRepo{pool: pool}
}

func (r *ListRepo) Create(ctx context.Context, l *models.List) error {
	var maxPos *float64
	r.pool.QueryRow(ctx,
		`SELECT MAX(position) FROM lists WHERE board_id = $1 AND is_archived = FALSE`,
		l.BoardID,
	).Scan(&maxPos)

	if maxPos != nil {
		l.Position = *maxPos + 1024
	} else {
		l.Position = 1024
	}

	const q = `
		INSERT INTO lists (board_id, name, position)
		VALUES ($1, $2, $3)
		RETURNING id, created_at, updated_at`

	return r.pool.QueryRow(ctx, q, l.BoardID, l.Name, l.Position).
		Scan(&l.ID, &l.CreatedAt, &l.UpdatedAt)
}

func (r *ListRepo) FindByID(ctx context.Context, id string) (*models.List, error) {
	const q = `
		SELECT id, board_id, name, position, is_archived, created_at, updated_at
		FROM lists WHERE id = $1`

	l := &models.List{}
	err := r.pool.QueryRow(ctx, q, id).Scan(
		&l.ID, &l.BoardID, &l.Name, &l.Position, &l.IsArchived, &l.CreatedAt, &l.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, fmt.Errorf("list not found")
	}
	return l, err
}

func (r *ListRepo) Update(ctx context.Context, id, name string) error {
	ct, err := r.pool.Exec(ctx, `UPDATE lists SET name = $2 WHERE id = $1`, id, name)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return fmt.Errorf("list not found")
	}
	return nil
}

func (r *ListRepo) Archive(ctx context.Context, id string) error {
	ct, err := r.pool.Exec(ctx, `UPDATE lists SET is_archived = TRUE WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return fmt.Errorf("list not found")
	}
	return nil
}

func (r *ListRepo) Reorder(ctx context.Context, id string, position float64) error {
	ct, err := r.pool.Exec(ctx, `UPDATE lists SET position = $2 WHERE id = $1`, id, position)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return fmt.Errorf("list not found")
	}
	return nil
}

package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/dbbaskette/northstar/internal/models"
)

type LabelRepo struct {
	pool *pgxpool.Pool
}

func NewLabelRepo(pool *pgxpool.Pool) *LabelRepo {
	return &LabelRepo{pool: pool}
}

func (r *LabelRepo) Create(ctx context.Context, l *models.Label) error {
	const q = `
		INSERT INTO labels (board_id, name, color)
		VALUES ($1, $2, $3)
		RETURNING id, created_at`

	return r.pool.QueryRow(ctx, q, l.BoardID, l.Name, l.Color).
		Scan(&l.ID, &l.CreatedAt)
}

func (r *LabelRepo) Update(ctx context.Context, id, name, color string) error {
	ct, err := r.pool.Exec(ctx,
		`UPDATE labels SET name = $2, color = $3 WHERE id = $1`, id, name, color)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return fmt.Errorf("label not found")
	}
	return nil
}

func (r *LabelRepo) Delete(ctx context.Context, id string) error {
	ct, err := r.pool.Exec(ctx, `DELETE FROM labels WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return fmt.Errorf("label not found")
	}
	return nil
}

func (r *LabelRepo) AttachToCard(ctx context.Context, cardID, labelID string) error {
	_, err := r.pool.Exec(ctx,
		`INSERT INTO card_labels (card_id, label_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
		cardID, labelID)
	return err
}

func (r *LabelRepo) DetachFromCard(ctx context.Context, cardID, labelID string) error {
	_, err := r.pool.Exec(ctx,
		`DELETE FROM card_labels WHERE card_id = $1 AND label_id = $2`,
		cardID, labelID)
	return err
}

func (r *LabelRepo) AddAssignee(ctx context.Context, cardID, userID string) error {
	_, err := r.pool.Exec(ctx,
		`INSERT INTO card_assignees (card_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
		cardID, userID)
	return err
}

func (r *LabelRepo) RemoveAssignee(ctx context.Context, cardID, userID string) error {
	_, err := r.pool.Exec(ctx,
		`DELETE FROM card_assignees WHERE card_id = $1 AND user_id = $2`,
		cardID, userID)
	return err
}

package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/dbbaskette/northstar/internal/models"
)

type AttachmentRepo struct {
	pool *pgxpool.Pool
}

func NewAttachmentRepo(pool *pgxpool.Pool) *AttachmentRepo {
	return &AttachmentRepo{pool: pool}
}

func (r *AttachmentRepo) Create(ctx context.Context, a *models.Attachment) error {
	const q = `
		INSERT INTO attachments (card_id, uploader_id, kind, filename, mime_type, size_bytes, storage_key, url)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, created_at`
	return r.pool.QueryRow(ctx, q,
		a.CardID, a.UploaderID, a.Kind, a.Filename, a.MimeType, a.SizeBytes, a.StorageKey, a.URL,
	).Scan(&a.ID, &a.CreatedAt)
}

func (r *AttachmentRepo) FindByID(ctx context.Context, id string) (*models.Attachment, error) {
	const q = `
		SELECT id, card_id, uploader_id, kind, filename, mime_type, size_bytes, storage_key, url, created_at
		FROM attachments WHERE id = $1`
	a := &models.Attachment{}
	err := r.pool.QueryRow(ctx, q, id).Scan(
		&a.ID, &a.CardID, &a.UploaderID, &a.Kind, &a.Filename,
		&a.MimeType, &a.SizeBytes, &a.StorageKey, &a.URL, &a.CreatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, fmt.Errorf("attachment not found")
	}
	return a, err
}

func (r *AttachmentRepo) Delete(ctx context.Context, id string) error {
	ct, err := r.pool.Exec(ctx, `DELETE FROM attachments WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return fmt.Errorf("attachment not found")
	}
	return nil
}

func (r *AttachmentRepo) ListByCard(ctx context.Context, cardID string) ([]models.Attachment, error) {
	const q = `
		SELECT id, card_id, uploader_id, kind, filename, mime_type, size_bytes, storage_key, url, created_at
		FROM attachments WHERE card_id = $1 ORDER BY created_at DESC`
	rows, err := r.pool.Query(ctx, q, cardID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []models.Attachment
	for rows.Next() {
		var a models.Attachment
		if err := rows.Scan(
			&a.ID, &a.CardID, &a.UploaderID, &a.Kind, &a.Filename,
			&a.MimeType, &a.SizeBytes, &a.StorageKey, &a.URL, &a.CreatedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

// CountsByCardIDs returns attachment count per card for the board view badge.
func (r *AttachmentRepo) CountsByCardIDs(ctx context.Context, cardIDs []string) (map[string]int, error) {
	if len(cardIDs) == 0 {
		return map[string]int{}, nil
	}
	rows, err := r.pool.Query(ctx, `
		SELECT card_id::text, COUNT(*)::int FROM attachments
		WHERE card_id = ANY($1) GROUP BY card_id`, cardIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := map[string]int{}
	for rows.Next() {
		var id string
		var n int
		if err := rows.Scan(&id, &n); err != nil {
			return nil, err
		}
		out[id] = n
	}
	return out, rows.Err()
}

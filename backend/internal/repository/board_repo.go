package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/dbbaskette/northstar/internal/models"
)

type BoardRepo struct {
	pool *pgxpool.Pool
}

func NewBoardRepo(pool *pgxpool.Pool) *BoardRepo {
	return &BoardRepo{pool: pool}
}

func (r *BoardRepo) Create(ctx context.Context, b *models.Board) error {
	const q = `
		INSERT INTO boards (team_id, name, description, background, created_by)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at, updated_at`

	return r.pool.QueryRow(ctx, q,
		b.TeamID, b.Name, b.Description, b.Background, b.CreatedBy,
	).Scan(&b.ID, &b.CreatedAt, &b.UpdatedAt)
}

func (r *BoardRepo) FindByID(ctx context.Context, id string) (*models.Board, error) {
	const q = `
		SELECT id, team_id, name, description, background, is_archived, created_by, created_at, updated_at
		FROM boards
		WHERE id = $1 AND deleted_at IS NULL`

	b := &models.Board{}
	err := r.pool.QueryRow(ctx, q, id).Scan(
		&b.ID, &b.TeamID, &b.Name, &b.Description, &b.Background,
		&b.IsArchived, &b.CreatedBy, &b.CreatedAt, &b.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, fmt.Errorf("board not found")
	}
	return b, err
}

func (r *BoardRepo) ListByTeam(ctx context.Context, teamID string) ([]models.Board, error) {
	const q = `
		SELECT id, team_id, name, description, background, is_archived, created_by, created_at, updated_at
		FROM boards
		WHERE team_id = $1 AND deleted_at IS NULL
		ORDER BY created_at DESC`

	rows, err := r.pool.Query(ctx, q, teamID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var boards []models.Board
	for rows.Next() {
		var b models.Board
		if err := rows.Scan(
			&b.ID, &b.TeamID, &b.Name, &b.Description, &b.Background,
			&b.IsArchived, &b.CreatedBy, &b.CreatedAt, &b.UpdatedAt,
		); err != nil {
			return nil, err
		}
		boards = append(boards, b)
	}
	return boards, rows.Err()
}

func (r *BoardRepo) Update(ctx context.Context, id string, name, description, background string) error {
	const q = `
		UPDATE boards SET name = $2, description = $3, background = $4
		WHERE id = $1 AND deleted_at IS NULL`
	ct, err := r.pool.Exec(ctx, q, id, name, description, background)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return fmt.Errorf("board not found")
	}
	return nil
}

func (r *BoardRepo) Delete(ctx context.Context, id string) error {
	const q = `UPDATE boards SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL`
	ct, err := r.pool.Exec(ctx, q, id)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return fmt.Errorf("board not found")
	}
	return nil
}

func (r *BoardRepo) GetFullBoard(ctx context.Context, id string) (*models.Board, error) {
	board, err := r.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}

	listsQ := `
		SELECT id, board_id, name, position, is_archived, created_at, updated_at
		FROM lists
		WHERE board_id = $1 AND is_archived = FALSE
		ORDER BY position`

	listRows, err := r.pool.Query(ctx, listsQ, id)
	if err != nil {
		return nil, err
	}
	defer listRows.Close()

	for listRows.Next() {
		var l models.List
		if err := listRows.Scan(
			&l.ID, &l.BoardID, &l.Name, &l.Position, &l.IsArchived, &l.CreatedAt, &l.UpdatedAt,
		); err != nil {
			return nil, err
		}
		board.Lists = append(board.Lists, l)
	}
	if err := listRows.Err(); err != nil {
		return nil, err
	}

	cardsQ := `
		SELECT id, list_id, title, description, position, priority, due_date, completed_at,
		       is_archived, created_by, created_at, updated_at
		FROM cards
		WHERE list_id = ANY($1) AND deleted_at IS NULL AND is_archived = FALSE
		ORDER BY position`

	listIDs := make([]string, len(board.Lists))
	for i, l := range board.Lists {
		listIDs[i] = fmt.Sprintf("%x-%x-%x-%x-%x",
			l.ID.Bytes[0:4], l.ID.Bytes[4:6], l.ID.Bytes[6:8], l.ID.Bytes[8:10], l.ID.Bytes[10:16])
	}

	if len(listIDs) > 0 {
		cardRows, err := r.pool.Query(ctx, cardsQ, listIDs)
		if err != nil {
			return nil, err
		}
		defer cardRows.Close()

		cardsByList := make(map[string][]models.Card)
		for cardRows.Next() {
			var c models.Card
			if err := cardRows.Scan(
				&c.ID, &c.ListID, &c.Title, &c.Description, &c.Position,
				&c.Priority, &c.DueDate, &c.CompletedAt, &c.IsArchived,
				&c.CreatedBy, &c.CreatedAt, &c.UpdatedAt,
			); err != nil {
				return nil, err
			}
			lid := fmt.Sprintf("%x-%x-%x-%x-%x",
				c.ListID.Bytes[0:4], c.ListID.Bytes[4:6], c.ListID.Bytes[6:8], c.ListID.Bytes[8:10], c.ListID.Bytes[10:16])
			cardsByList[lid] = append(cardsByList[lid], c)
		}
		if err := cardRows.Err(); err != nil {
			return nil, err
		}

		for i := range board.Lists {
			lid := fmt.Sprintf("%x-%x-%x-%x-%x",
				board.Lists[i].ID.Bytes[0:4], board.Lists[i].ID.Bytes[4:6],
				board.Lists[i].ID.Bytes[6:8], board.Lists[i].ID.Bytes[8:10], board.Lists[i].ID.Bytes[10:16])
			board.Lists[i].Cards = cardsByList[lid]
		}

		// Attach checklist counts to each card
		var allCardIDs []string
		for _, l := range board.Lists {
			for _, c := range l.Cards {
				allCardIDs = append(allCardIDs, fmt.Sprintf("%x-%x-%x-%x-%x",
					c.ID.Bytes[0:4], c.ID.Bytes[4:6], c.ID.Bytes[6:8], c.ID.Bytes[8:10], c.ID.Bytes[10:16]))
			}
		}
		if len(allCardIDs) > 0 {
			checklistRepo := &ChecklistRepo{pool: r.pool}
			counts, err := checklistRepo.CountsByCardIDs(ctx, allCardIDs)
			if err != nil {
				return nil, err
			}

			attachmentRepo := &AttachmentRepo{pool: r.pool}
			attachCounts, err := attachmentRepo.CountsByCardIDs(ctx, allCardIDs)
			if err != nil {
				return nil, err
			}

			for i := range board.Lists {
				for j := range board.Lists[i].Cards {
					c := &board.Lists[i].Cards[j]
					cardID := fmt.Sprintf("%x-%x-%x-%x-%x",
						c.ID.Bytes[0:4], c.ID.Bytes[4:6], c.ID.Bytes[6:8], c.ID.Bytes[8:10], c.ID.Bytes[10:16])
					if v, ok := counts[cardID]; ok {
						c.ChecklistTotal = v[0]
						c.ChecklistDone = v[1]
					}
					if n, ok := attachCounts[cardID]; ok {
						c.AttachmentCount = n
					}
				}
			}
		}
	}

	labelsQ := `
		SELECT id, board_id, name, color, created_at
		FROM labels WHERE board_id = $1 ORDER BY name`

	labelRows, err := r.pool.Query(ctx, labelsQ, id)
	if err != nil {
		return nil, err
	}
	defer labelRows.Close()

	for labelRows.Next() {
		var l models.Label
		if err := labelRows.Scan(&l.ID, &l.BoardID, &l.Name, &l.Color, &l.CreatedAt); err != nil {
			return nil, err
		}
		board.Labels = append(board.Labels, l)
	}

	return board, labelRows.Err()
}

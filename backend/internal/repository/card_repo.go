package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/dbbaskette/northstar/internal/models"
)

type CardRepo struct {
	pool *pgxpool.Pool
}

func NewCardRepo(pool *pgxpool.Pool) *CardRepo {
	return &CardRepo{pool: pool}
}

const cardSelectColumns = `id, list_id, title, description, position, priority, due_date, completed_at,
		is_archived, created_by, created_at, updated_at`

func scanCard(row pgx.Row, c *models.Card) error {
	return row.Scan(
		&c.ID, &c.ListID, &c.Title, &c.Description, &c.Position,
		&c.Priority, &c.DueDate, &c.CompletedAt, &c.IsArchived,
		&c.CreatedBy, &c.CreatedAt, &c.UpdatedAt,
	)
}

func (r *CardRepo) Create(ctx context.Context, c *models.Card) error {
	var maxPos *float64
	r.pool.QueryRow(ctx,
		`SELECT MAX(position) FROM cards WHERE list_id = $1 AND deleted_at IS NULL AND is_archived = FALSE`,
		c.ListID,
	).Scan(&maxPos)

	if maxPos != nil {
		c.Position = *maxPos + 1024
	} else {
		c.Position = 1024
	}

	const q = `
		INSERT INTO cards (list_id, title, description, position, created_by)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at, updated_at`

	return r.pool.QueryRow(ctx, q,
		c.ListID, c.Title, c.Description, c.Position, c.CreatedBy,
	).Scan(&c.ID, &c.CreatedAt, &c.UpdatedAt)
}

func (r *CardRepo) FindByID(ctx context.Context, id string) (*models.Card, error) {
	q := `SELECT ` + cardSelectColumns + ` FROM cards WHERE id = $1 AND deleted_at IS NULL`

	c := &models.Card{}
	err := scanCard(r.pool.QueryRow(ctx, q, id), c)
	if err == pgx.ErrNoRows {
		return nil, fmt.Errorf("card not found")
	}
	return c, err
}

type CardUpdate struct {
	Title       string
	Description string
	DueDate     *time.Time
	Priority    *string
	Completed  *bool
}

func (r *CardRepo) Update(ctx context.Context, id string, u CardUpdate) error {
	var dueDate pgtype.Timestamptz
	if u.DueDate != nil {
		dueDate = pgtype.Timestamptz{Time: *u.DueDate, Valid: true}
	}

	var priority pgtype.Text
	if u.Priority != nil && *u.Priority != "" {
		priority = pgtype.Text{String: *u.Priority, Valid: true}
	}

	const q = `
		UPDATE cards
		SET title = $2,
		    description = $3,
		    due_date = $4,
		    priority = $5,
		    completed_at = CASE
		        WHEN $6::boolean IS NULL THEN completed_at
		        WHEN $6::boolean = TRUE  AND completed_at IS NULL THEN NOW()
		        WHEN $6::boolean = FALSE THEN NULL
		        ELSE completed_at
		    END
		WHERE id = $1 AND deleted_at IS NULL`

	ct, err := r.pool.Exec(ctx, q, id, u.Title, u.Description, dueDate, priority, u.Completed)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return fmt.Errorf("card not found")
	}
	return nil
}

func (r *CardRepo) Delete(ctx context.Context, id string) error {
	ct, err := r.pool.Exec(ctx,
		`UPDATE cards SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL`, id)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return fmt.Errorf("card not found")
	}
	return nil
}

func (r *CardRepo) Move(ctx context.Context, id, listID string, position float64) error {
	const q = `
		UPDATE cards SET list_id = $2, position = $3
		WHERE id = $1 AND deleted_at IS NULL`
	ct, err := r.pool.Exec(ctx, q, id, listID, position)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return fmt.Errorf("card not found")
	}
	return nil
}

func (r *CardRepo) Reorder(ctx context.Context, id string, position float64) error {
	ct, err := r.pool.Exec(ctx,
		`UPDATE cards SET position = $2 WHERE id = $1 AND deleted_at IS NULL`, id, position)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return fmt.Errorf("card not found")
	}
	return nil
}

func (r *CardRepo) GetCardWithDetails(ctx context.Context, id string) (*models.Card, error) {
	card, err := r.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}

	labelsQ := `
		SELECT l.id, l.board_id, l.name, l.color, l.created_at
		FROM labels l
		JOIN card_labels cl ON l.id = cl.label_id
		WHERE cl.card_id = $1
		ORDER BY l.name`

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
		card.Labels = append(card.Labels, l)
	}

	assigneesQ := `
		SELECT u.id, u.email, u.username, u.display_name, u.avatar_url, u.role, u.created_at, u.updated_at
		FROM users u
		JOIN card_assignees ca ON u.id = ca.user_id
		WHERE ca.card_id = $1
		ORDER BY u.display_name`

	assigneeRows, err := r.pool.Query(ctx, assigneesQ, id)
	if err != nil {
		return nil, err
	}
	defer assigneeRows.Close()

	for assigneeRows.Next() {
		var u models.User
		if err := assigneeRows.Scan(
			&u.ID, &u.Email, &u.Username, &u.DisplayName,
			&u.AvatarURL, &u.Role, &u.CreatedAt, &u.UpdatedAt,
		); err != nil {
			return nil, err
		}
		card.Assignees = append(card.Assignees, u)
	}

	commentsQ := `
		SELECT c.id, c.card_id, c.user_id, c.body, c.created_at, c.updated_at,
		       u.id, u.email, u.username, u.display_name, u.avatar_url, u.role
		FROM card_comments c
		JOIN users u ON c.user_id = u.id
		WHERE c.card_id = $1
		ORDER BY c.created_at`

	commentRows, err := r.pool.Query(ctx, commentsQ, id)
	if err != nil {
		return nil, err
	}
	defer commentRows.Close()

	for commentRows.Next() {
		var cm models.Comment
		u := &models.User{}
		if err := commentRows.Scan(
			&cm.ID, &cm.CardID, &cm.UserID, &cm.Body, &cm.CreatedAt, &cm.UpdatedAt,
			&u.ID, &u.Email, &u.Username, &u.DisplayName, &u.AvatarURL, &u.Role,
		); err != nil {
			return nil, err
		}
		cm.User = u
		card.Comments = append(card.Comments, cm)
	}

	checklistRepo := &ChecklistRepo{pool: r.pool}
	checklists, err := checklistRepo.ListWithItemsByCard(ctx, id)
	if err != nil {
		return nil, err
	}
	card.Checklists = checklists

	return card, nil
}

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

type ChecklistRepo struct {
	pool *pgxpool.Pool
}

func NewChecklistRepo(pool *pgxpool.Pool) *ChecklistRepo {
	return &ChecklistRepo{pool: pool}
}

func (r *ChecklistRepo) Create(ctx context.Context, c *models.Checklist) error {
	var maxPos *float64
	r.pool.QueryRow(ctx,
		`SELECT MAX(position) FROM checklists WHERE card_id = $1`, c.CardID,
	).Scan(&maxPos)

	if maxPos != nil {
		c.Position = *maxPos + 1024
	} else {
		c.Position = 1024
	}

	const q = `INSERT INTO checklists (card_id, title, position)
		VALUES ($1, $2, $3) RETURNING id, created_at, updated_at`
	return r.pool.QueryRow(ctx, q, c.CardID, c.Title, c.Position).
		Scan(&c.ID, &c.CreatedAt, &c.UpdatedAt)
}

func (r *ChecklistRepo) FindByID(ctx context.Context, id string) (*models.Checklist, error) {
	const q = `SELECT id, card_id, title, position, created_at, updated_at
		FROM checklists WHERE id = $1`
	c := &models.Checklist{}
	err := r.pool.QueryRow(ctx, q, id).Scan(
		&c.ID, &c.CardID, &c.Title, &c.Position, &c.CreatedAt, &c.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, fmt.Errorf("checklist not found")
	}
	return c, err
}

func (r *ChecklistRepo) Update(ctx context.Context, id, title string) error {
	ct, err := r.pool.Exec(ctx, `UPDATE checklists SET title = $2 WHERE id = $1`, id, title)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return fmt.Errorf("checklist not found")
	}
	return nil
}

func (r *ChecklistRepo) Delete(ctx context.Context, id string) error {
	ct, err := r.pool.Exec(ctx, `DELETE FROM checklists WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return fmt.Errorf("checklist not found")
	}
	return nil
}

func (r *ChecklistRepo) ListWithItemsByCard(ctx context.Context, cardID string) ([]models.Checklist, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, card_id, title, position, created_at, updated_at
		 FROM checklists WHERE card_id = $1 ORDER BY position`,
		cardID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var lists []models.Checklist
	idMap := make(map[string]int)
	for rows.Next() {
		var c models.Checklist
		if err := rows.Scan(&c.ID, &c.CardID, &c.Title, &c.Position, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		idMap[uuidString(c.ID)] = len(lists)
		lists = append(lists, c)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if len(lists) == 0 {
		return lists, nil
	}

	checklistIDs := make([]string, 0, len(lists))
	for k := range idMap {
		checklistIDs = append(checklistIDs, k)
	}

	itemRows, err := r.pool.Query(ctx, `
		SELECT id, checklist_id, text, is_complete, position, due_date, assignee_id, created_at, updated_at
		FROM checklist_items WHERE checklist_id = ANY($1) ORDER BY position`,
		checklistIDs)
	if err != nil {
		return nil, err
	}
	defer itemRows.Close()

	for itemRows.Next() {
		var item models.ChecklistItem
		if err := itemRows.Scan(
			&item.ID, &item.ChecklistID, &item.Text, &item.IsComplete, &item.Position,
			&item.DueDate, &item.AssigneeID, &item.CreatedAt, &item.UpdatedAt,
		); err != nil {
			return nil, err
		}
		idx, ok := idMap[uuidString(item.ChecklistID)]
		if ok {
			lists[idx].Items = append(lists[idx].Items, item)
		}
	}
	return lists, itemRows.Err()
}

// CountsByCard returns total and completed item counts per card id.
func (r *ChecklistRepo) CountsByCardIDs(ctx context.Context, cardIDs []string) (map[string][2]int, error) {
	if len(cardIDs) == 0 {
		return map[string][2]int{}, nil
	}
	rows, err := r.pool.Query(ctx, `
		SELECT c.card_id,
		       COUNT(ci.*)::int                                AS total,
		       COUNT(*) FILTER (WHERE ci.is_complete)::int     AS done
		FROM checklists c
		LEFT JOIN checklist_items ci ON ci.checklist_id = c.id
		WHERE c.card_id = ANY($1)
		GROUP BY c.card_id`, cardIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := map[string][2]int{}
	for rows.Next() {
		var cardID string
		var total, done int
		if err := rows.Scan(&cardID, &total, &done); err != nil {
			return nil, err
		}
		out[cardID] = [2]int{total, done}
	}
	return out, rows.Err()
}

// Items

type ItemUpdate struct {
	Text       *string
	IsComplete *bool
	DueDate    *time.Time
	AssigneeID *string
}

func (r *ChecklistRepo) CreateItem(ctx context.Context, item *models.ChecklistItem) error {
	var maxPos *float64
	r.pool.QueryRow(ctx,
		`SELECT MAX(position) FROM checklist_items WHERE checklist_id = $1`, item.ChecklistID,
	).Scan(&maxPos)

	if maxPos != nil {
		item.Position = *maxPos + 1024
	} else {
		item.Position = 1024
	}

	const q = `INSERT INTO checklist_items (checklist_id, text, position)
		VALUES ($1, $2, $3) RETURNING id, is_complete, created_at, updated_at`
	return r.pool.QueryRow(ctx, q, item.ChecklistID, item.Text, item.Position).
		Scan(&item.ID, &item.IsComplete, &item.CreatedAt, &item.UpdatedAt)
}

func (r *ChecklistRepo) UpdateItem(ctx context.Context, id string, u ItemUpdate) error {
	var (
		text       *string
		isComplete *bool
		dueDate    pgtype.Timestamptz
		assignee   pgtype.UUID
	)
	if u.Text != nil {
		text = u.Text
	}
	if u.IsComplete != nil {
		isComplete = u.IsComplete
	}
	if u.DueDate != nil {
		dueDate = pgtype.Timestamptz{Time: *u.DueDate, Valid: true}
	}
	if u.AssigneeID != nil && *u.AssigneeID != "" {
		assignee.Scan(*u.AssigneeID)
	}

	const q = `
		UPDATE checklist_items
		SET text        = COALESCE($2, text),
		    is_complete = COALESCE($3, is_complete),
		    due_date    = CASE WHEN $4::boolean THEN $5 ELSE due_date END,
		    assignee_id = CASE WHEN $6::boolean THEN $7 ELSE assignee_id END
		WHERE id = $1`

	hasDue := u.DueDate != nil
	hasAssignee := u.AssigneeID != nil

	ct, err := r.pool.Exec(ctx, q, id, text, isComplete, hasDue, dueDate, hasAssignee, assignee)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return fmt.Errorf("item not found")
	}
	return nil
}

func (r *ChecklistRepo) DeleteItem(ctx context.Context, id string) error {
	ct, err := r.pool.Exec(ctx, `DELETE FROM checklist_items WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return fmt.Errorf("item not found")
	}
	return nil
}

func (r *ChecklistRepo) ReorderItem(ctx context.Context, id string, position float64) error {
	ct, err := r.pool.Exec(ctx,
		`UPDATE checklist_items SET position = $2 WHERE id = $1`, id, position)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return fmt.Errorf("item not found")
	}
	return nil
}

func uuidString(id pgtype.UUID) string {
	if !id.Valid {
		return ""
	}
	b := id.Bytes
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

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

const cardSelectColumns = `id, list_id, title, description, position, priority, start_date, due_date, completed_at,
		cover_attachment_id, cover_color, cover_size::text,
		is_archived, created_by, created_at, updated_at`

func scanCard(row pgx.Row, c *models.Card) error {
	return row.Scan(
		&c.ID, &c.ListID, &c.Title, &c.Description, &c.Position,
		&c.Priority, &c.StartDate, &c.DueDate, &c.CompletedAt,
		&c.CoverAttachmentID, &c.CoverColor, &c.CoverSize,
		&c.IsArchived, &c.CreatedBy, &c.CreatedAt, &c.UpdatedAt,
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
	StartDate   *time.Time
	Priority    *string
	Completed   *bool
}

func (r *CardRepo) Update(ctx context.Context, id string, u CardUpdate) error {
	var dueDate pgtype.Timestamptz
	if u.DueDate != nil {
		dueDate = pgtype.Timestamptz{Time: *u.DueDate, Valid: true}
	}
	var startDate pgtype.Timestamptz
	if u.StartDate != nil {
		startDate = pgtype.Timestamptz{Time: *u.StartDate, Valid: true}
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
		    start_date = $7,
		    completed_at = CASE
		        WHEN $6::boolean IS NULL THEN completed_at
		        WHEN $6::boolean = TRUE  AND completed_at IS NULL THEN NOW()
		        WHEN $6::boolean = FALSE THEN NULL
		        ELSE completed_at
		    END
		WHERE id = $1 AND deleted_at IS NULL`

	ct, err := r.pool.Exec(ctx, q, id, u.Title, u.Description, dueDate, priority, u.Completed, startDate)
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

// SetCompleted toggles the completed_at flag without touching other fields.
func (r *CardRepo) SetCompleted(ctx context.Context, id string, completed bool) error {
	const q = `
		UPDATE cards
		SET completed_at = CASE WHEN $2 THEN NOW() ELSE NULL END
		WHERE id = $1 AND deleted_at IS NULL`
	ct, err := r.pool.Exec(ctx, q, id, completed)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return fmt.Errorf("card not found")
	}
	return nil
}

type CoverUpdate struct {
	AttachmentID *string // nil = no change, "" = clear
	Color        *string
	Size         *string // 'half' | 'full' | ''
}

func (r *CardRepo) SetCover(ctx context.Context, id string, u CoverUpdate) error {
	var (
		attachID  pgtype.UUID
		color     pgtype.Text
		size      pgtype.Text
	)
	if u.AttachmentID != nil && *u.AttachmentID != "" {
		attachID.Scan(*u.AttachmentID)
	}
	if u.Color != nil && *u.Color != "" {
		color = pgtype.Text{String: *u.Color, Valid: true}
	}
	if u.Size != nil && *u.Size != "" {
		size = pgtype.Text{String: *u.Size, Valid: true}
	}

	const q = `
		UPDATE cards
		SET cover_attachment_id = $2,
		    cover_color = $3,
		    cover_size = $4::card_cover_size
		WHERE id = $1 AND deleted_at IS NULL`

	ct, err := r.pool.Exec(ctx, q, id, attachID, color, size)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return fmt.Errorf("card not found")
	}
	return nil
}

func (r *CardRepo) Restore(ctx context.Context, id string) error {
	ct, err := r.pool.Exec(ctx,
		`UPDATE cards SET deleted_at = NULL WHERE id = $1 AND deleted_at IS NOT NULL`, id)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return fmt.Errorf("card not found or not archived")
	}
	return nil
}

func (r *CardRepo) PermanentDelete(ctx context.Context, id string) error {
	ct, err := r.pool.Exec(ctx, `DELETE FROM cards WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return fmt.Errorf("card not found")
	}
	return nil
}

func (r *CardRepo) ListArchivedByBoard(ctx context.Context, boardID string) ([]models.Card, error) {
	q := `
		SELECT c.id, c.list_id, c.title, c.description, c.position, c.priority,
		       c.due_date, c.completed_at,
		       c.cover_attachment_id, c.cover_color, c.cover_size::text,
		       c.is_archived, c.created_by,
		       c.created_at, c.updated_at, c.deleted_at
		FROM cards c
		JOIN lists l ON c.list_id = l.id
		WHERE l.board_id = $1 AND c.deleted_at IS NOT NULL
		ORDER BY c.deleted_at DESC
		LIMIT 200`

	rows, err := r.pool.Query(ctx, q, boardID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []models.Card
	for rows.Next() {
		var c models.Card
		if err := rows.Scan(
			&c.ID, &c.ListID, &c.Title, &c.Description, &c.Position,
			&c.Priority, &c.DueDate, &c.CompletedAt,
			&c.CoverAttachmentID, &c.CoverColor, &c.CoverSize,
			&c.IsArchived,
			&c.CreatedBy, &c.CreatedAt, &c.UpdatedAt, &c.DeletedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// NextPositionInList returns the next slot at the bottom of the given list,
// computed as MAX(position) + 1024 (or 1024 if the list is empty).
func (r *CardRepo) NextPositionInList(ctx context.Context, listID string) (float64, error) {
	var maxPos *float64
	if err := r.pool.QueryRow(ctx,
		`SELECT MAX(position) FROM cards WHERE list_id = $1 AND deleted_at IS NULL AND is_archived = FALSE`,
		listID).Scan(&maxPos); err != nil {
		return 0, err
	}
	if maxPos == nil {
		return 1024, nil
	}
	return *maxPos + 1024, nil
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

	attachmentRepo := &AttachmentRepo{pool: r.pool}
	attachments, err := attachmentRepo.ListByCard(ctx, id)
	if err != nil {
		return nil, err
	}
	card.Attachments = attachments

	if len(card.Comments) > 0 {
		commentRepo := &CommentRepo{pool: r.pool}
		reactionsByComment, err := commentRepo.ReactionsByCardID(ctx, id)
		if err != nil {
			return nil, err
		}
		for i := range card.Comments {
			cid := uuidToStr(card.Comments[i].ID)
			if rs, ok := reactionsByComment[cid]; ok {
				card.Comments[i].Reactions = rs
			}
		}
	}

	// Load custom field values
	cfRows, err := r.pool.Query(ctx, `
		SELECT field_def_id::text, value_text, value_number, value_date, value_bool
		FROM custom_field_values WHERE card_id = $1`, id)
	if err != nil {
		return nil, err
	}
	defer cfRows.Close()
	for cfRows.Next() {
		var (
			fid   string
			vtext pgtype.Text
			vnum  pgtype.Float8
			vdate pgtype.Timestamptz
			vbool pgtype.Bool
		)
		if err := cfRows.Scan(&fid, &vtext, &vnum, &vdate, &vbool); err != nil {
			return nil, err
		}
		v := models.CustomFieldValue{FieldDefID: fid}
		if vtext.Valid {
			v.Text = vtext.String
		}
		if vnum.Valid {
			v.Number = vnum.Float64
		}
		if vdate.Valid {
			v.Date = vdate.Time.Format("2006-01-02T15:04:05Z07:00")
		}
		if vbool.Valid {
			v.Bool = vbool.Bool
		}
		card.CustomFields = append(card.CustomFields, v)
	}

	return card, nil
}

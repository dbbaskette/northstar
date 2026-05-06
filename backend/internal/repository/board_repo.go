package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
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
		SELECT id, team_id, name, description, background, visibility, is_template, is_archived, created_by, created_at, updated_at
		FROM boards
		WHERE id = $1 AND deleted_at IS NULL`

	b := &models.Board{}
	err := r.pool.QueryRow(ctx, q, id).Scan(
		&b.ID, &b.TeamID, &b.Name, &b.Description, &b.Background, &b.Visibility,
		&b.IsTemplate, &b.IsArchived, &b.CreatedBy, &b.CreatedAt, &b.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, fmt.Errorf("board not found")
	}
	return b, err
}

func (r *BoardRepo) ListByTeam(ctx context.Context, teamID string) ([]models.Board, error) {
	const q = `
		SELECT id, team_id, name, description, background, visibility, is_template, is_archived, created_by, created_at, updated_at
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
			&b.ID, &b.TeamID, &b.Name, &b.Description, &b.Background, &b.Visibility,
			&b.IsTemplate, &b.IsArchived, &b.CreatedBy, &b.CreatedAt, &b.UpdatedAt,
		); err != nil {
			return nil, err
		}
		boards = append(boards, b)
	}
	return boards, rows.Err()
}

func (r *BoardRepo) SetTemplate(ctx context.Context, id string, isTemplate bool) error {
	ct, err := r.pool.Exec(ctx,
		`UPDATE boards SET is_template = $2 WHERE id = $1 AND deleted_at IS NULL`,
		id, isTemplate)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return fmt.Errorf("board not found")
	}
	return nil
}

// ListTemplatesForUser returns boards marked is_template across all
// teams the user belongs to.
func (r *BoardRepo) ListTemplatesForUser(ctx context.Context, userID string) ([]models.Board, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT b.id, b.team_id, b.name, b.description, b.background, b.visibility::text,
		       b.is_template, b.is_archived, b.created_by, b.created_at, b.updated_at
		FROM boards b
		JOIN team_members tm ON tm.team_id = b.team_id
		WHERE b.is_template = TRUE AND b.deleted_at IS NULL AND tm.user_id = $1
		ORDER BY b.name`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []models.Board
	for rows.Next() {
		var b models.Board
		if err := rows.Scan(&b.ID, &b.TeamID, &b.Name, &b.Description, &b.Background, &b.Visibility,
			&b.IsTemplate, &b.IsArchived, &b.CreatedBy, &b.CreatedAt, &b.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

func (r *BoardRepo) UpdateVisibility(ctx context.Context, id, visibility string) error {
	ct, err := r.pool.Exec(ctx,
		`UPDATE boards SET visibility = $2 WHERE id = $1 AND deleted_at IS NULL`,
		id, visibility)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return fmt.Errorf("board not found")
	}
	return nil
}

// AccessibleByUser returns the user's effective role on the board
// ('owner' | 'admin' | 'member' | 'viewer'), or empty string if no access.
// For visibility='team', team membership grants member-level access.
// For visibility='private', only board_members entries grant access.
func (r *BoardRepo) AccessibleByUser(ctx context.Context, boardID, userID string) (string, error) {
	board, err := r.FindByID(ctx, boardID)
	if err != nil {
		return "", err
	}

	// Direct board membership trumps team membership
	var boardRole string
	err = r.pool.QueryRow(ctx,
		`SELECT role::text FROM board_members WHERE board_id = $1 AND user_id = $2`,
		boardID, userID).Scan(&boardRole)
	if err == nil && boardRole != "" {
		return boardRole, nil
	}

	if board.Visibility == "private" {
		return "", nil
	}

	// Team-visible boards: any team member can read
	var teamRole string
	err = r.pool.QueryRow(ctx,
		`SELECT role::text FROM team_members WHERE team_id = $1 AND user_id = $2`,
		uuidToStr(board.TeamID), userID).Scan(&teamRole)
	if err != nil {
		return "", nil
	}
	if teamRole == "owner" || teamRole == "admin" {
		return "admin", nil
	}
	return "member", nil
}

func (r *BoardRepo) AddMember(ctx context.Context, boardID, userID, role string) error {
	_, err := r.pool.Exec(ctx,
		`INSERT INTO board_members (board_id, user_id, role) VALUES ($1, $2, $3)
		 ON CONFLICT (board_id, user_id) DO UPDATE SET role = $3`,
		boardID, userID, role)
	return err
}

func (r *BoardRepo) RemoveMember(ctx context.Context, boardID, userID string) error {
	_, err := r.pool.Exec(ctx,
		`DELETE FROM board_members WHERE board_id = $1 AND user_id = $2`,
		boardID, userID)
	return err
}

func (r *BoardRepo) ListMembers(ctx context.Context, boardID string) ([]models.BoardMember, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT bm.board_id, bm.user_id, bm.role::text,
		       u.id, u.email, u.username, u.display_name, u.avatar_url, u.role
		FROM board_members bm
		JOIN users u ON bm.user_id = u.id
		WHERE bm.board_id = $1
		ORDER BY u.display_name`, boardID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []models.BoardMember
	for rows.Next() {
		var m models.BoardMember
		u := &models.User{}
		if err := rows.Scan(
			&m.BoardID, &m.UserID, &m.Role,
			&u.ID, &u.Email, &u.Username, &u.DisplayName, &u.AvatarURL, &u.Role,
		); err != nil {
			return nil, err
		}
		m.User = u
		out = append(out, m)
	}
	return out, rows.Err()
}

func uuidToStr(id pgtype.UUID) string {
	if !id.Valid {
		return ""
	}
	b := id.Bytes
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
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
		       cover_attachment_id, cover_color, cover_size::text,
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
				&c.Priority, &c.DueDate, &c.CompletedAt,
				&c.CoverAttachmentID, &c.CoverColor, &c.CoverSize,
				&c.IsArchived,
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

			// Fetch labels per card for the board view
			labelRows, err := r.pool.Query(ctx, `
				SELECT cl.card_id::text, l.id, l.board_id, l.name, l.color, l.created_at
				FROM card_labels cl
				JOIN labels l ON l.id = cl.label_id
				WHERE cl.card_id = ANY($1)
				ORDER BY l.name`, allCardIDs)
			if err != nil {
				return nil, err
			}
			labelsByCard := make(map[string][]models.Label)
			for labelRows.Next() {
				var cardIDStr string
				var lab models.Label
				if err := labelRows.Scan(&cardIDStr, &lab.ID, &lab.BoardID, &lab.Name, &lab.Color, &lab.CreatedAt); err != nil {
					labelRows.Close()
					return nil, err
				}
				labelsByCard[cardIDStr] = append(labelsByCard[cardIDStr], lab)
			}
			labelRows.Close()

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
					if labs, ok := labelsByCard[cardID]; ok {
						c.Labels = labs
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

package service

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

type BoardCopier struct {
	pool *pgxpool.Pool
}

func NewBoardCopier(pool *pgxpool.Pool) *BoardCopier {
	return &BoardCopier{pool: pool}
}

// CopyList duplicates a list and all of its non-archived cards into the
// same board, appended to the end. Returns the new list id.
func (c *BoardCopier) CopyList(ctx context.Context, sourceListID, actorUserID string) (string, error) {
	tx, err := c.pool.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer tx.Rollback(ctx)

	var (
		boardID string
		title   string
	)
	if err := tx.QueryRow(ctx,
		`SELECT board_id::text, name FROM lists WHERE id = $1`, sourceListID).
		Scan(&boardID, &title); err != nil {
		return "", fmt.Errorf("source list not found: %w", err)
	}

	var maxPos *float64
	tx.QueryRow(ctx,
		`SELECT MAX(position) FROM lists WHERE board_id = $1 AND is_archived = FALSE`,
		boardID).Scan(&maxPos)
	pos := 1024.0
	if maxPos != nil {
		pos = *maxPos + 1024
	}

	var newListID string
	if err := tx.QueryRow(ctx, `
		INSERT INTO lists (board_id, name, position) VALUES ($1, $2, $3) RETURNING id`,
		boardID, title+" (copy)", pos).Scan(&newListID); err != nil {
		return "", err
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO cards (list_id, title, description, position, due_date, priority,
		                   cover_attachment_id, cover_color, cover_size, created_by)
		SELECT $1, title, description, position, due_date, priority,
		       cover_attachment_id, cover_color, cover_size, $2
		FROM cards
		WHERE list_id = $3 AND deleted_at IS NULL AND is_archived = FALSE`,
		newListID, actorUserID, sourceListID); err != nil {
		return "", err
	}

	// Re-link labels: cards are unique per (list_id, position) so we can
	// match the new card to its source by position.
	if _, err := tx.Exec(ctx, `
		INSERT INTO card_labels (card_id, label_id)
		SELECT new_c.id, cl.label_id
		FROM cards new_c
		JOIN cards old_c ON old_c.list_id = $2 AND old_c.position = new_c.position
		JOIN card_labels cl ON cl.card_id = old_c.id
		WHERE new_c.list_id = $1`,
		newListID, sourceListID); err != nil {
		return "", err
	}

	if err := tx.Commit(ctx); err != nil {
		return "", err
	}
	return newListID, nil
}

// CopyBoard clones a board into the same team. Includes lists, cards,
// and labels. Comments, attachments, checklists, and activity are NOT copied.
func (c *BoardCopier) CopyBoard(
	ctx context.Context,
	sourceBoardID, actorUserID, newName string,
) (string, error) {
	tx, err := c.pool.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer tx.Rollback(ctx)

	var (
		teamID, origName, origDesc, origBg, origVis string
	)
	if err := tx.QueryRow(ctx, `
		SELECT team_id::text, name, COALESCE(description, ''),
		       COALESCE(background, '#0079BF'), visibility::text
		FROM boards WHERE id = $1 AND deleted_at IS NULL`,
		sourceBoardID).Scan(&teamID, &origName, &origDesc, &origBg, &origVis); err != nil {
		return "", fmt.Errorf("source board not found: %w", err)
	}

	name := newName
	if name == "" {
		name = origName + " (copy)"
	}

	var newBoardID string
	if err := tx.QueryRow(ctx, `
		INSERT INTO boards (team_id, name, description, background, visibility, created_by)
		VALUES ($1, $2, $3, $4, $5::board_visibility, $6)
		RETURNING id`,
		teamID, name, origDesc, origBg, origVis, actorUserID,
	).Scan(&newBoardID); err != nil {
		return "", err
	}

	// Labels: re-create on the new board, build old→new map
	labelMap := make(map[string]string)
	{
		rows, err := tx.Query(ctx,
			`SELECT id::text, name, color FROM labels WHERE board_id = $1`, sourceBoardID)
		if err != nil {
			return "", err
		}
		type lab struct{ id, name, color string }
		var olds []lab
		for rows.Next() {
			var l lab
			if err := rows.Scan(&l.id, &l.name, &l.color); err != nil {
				rows.Close()
				return "", err
			}
			olds = append(olds, l)
		}
		rows.Close()
		for _, l := range olds {
			var newID string
			if err := tx.QueryRow(ctx,
				`INSERT INTO labels (board_id, name, color) VALUES ($1, $2, $3) RETURNING id::text`,
				newBoardID, l.name, l.color).Scan(&newID); err != nil {
				return "", err
			}
			labelMap[l.id] = newID
		}
	}

	// Lists: re-create, build old→new map
	listMap := make(map[string]string)
	{
		rows, err := tx.Query(ctx,
			`SELECT id::text, name, position FROM lists WHERE board_id = $1 AND is_archived = FALSE`,
			sourceBoardID)
		if err != nil {
			return "", err
		}
		type lst struct {
			id, name string
			position float64
		}
		var olds []lst
		for rows.Next() {
			var l lst
			if err := rows.Scan(&l.id, &l.name, &l.position); err != nil {
				rows.Close()
				return "", err
			}
			olds = append(olds, l)
		}
		rows.Close()
		for _, l := range olds {
			var newID string
			if err := tx.QueryRow(ctx,
				`INSERT INTO lists (board_id, name, position) VALUES ($1, $2, $3) RETURNING id::text`,
				newBoardID, l.name, l.position).Scan(&newID); err != nil {
				return "", err
			}
			listMap[l.id] = newID
		}
	}

	// Cards: insert into the new lists; build old→new map for label remap
	cardMap := make(map[string]string)
	for oldListID, newListID := range listMap {
		rows, err := tx.Query(ctx, `
			SELECT id::text, title, COALESCE(description, ''), position,
			       priority, due_date, cover_color, cover_size::text
			FROM cards WHERE list_id = $1 AND deleted_at IS NULL AND is_archived = FALSE`,
			oldListID)
		if err != nil {
			return "", err
		}
		type cardRow struct {
			id, title, description string
			position               float64
			priority               *string
			coverColor             *string
			coverSize              *string
			due                    interface{}
		}
		var olds []cardRow
		for rows.Next() {
			var c cardRow
			if err := rows.Scan(&c.id, &c.title, &c.description, &c.position,
				&c.priority, &c.due, &c.coverColor, &c.coverSize); err != nil {
				rows.Close()
				return "", err
			}
			olds = append(olds, c)
		}
		rows.Close()

		for _, oc := range olds {
			var (
				prio interface{}
				size interface{}
			)
			if oc.priority != nil {
				prio = *oc.priority
			}
			if oc.coverSize != nil {
				size = *oc.coverSize
			}
			var newID string
			if err := tx.QueryRow(ctx, `
				INSERT INTO cards (list_id, title, description, position, due_date, priority,
				                   cover_color, cover_size, created_by)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8::card_cover_size, $9)
				RETURNING id::text`,
				newListID, oc.title, oc.description, oc.position, oc.due, prio,
				oc.coverColor, size, actorUserID,
			).Scan(&newID); err != nil {
				return "", err
			}
			cardMap[oc.id] = newID
		}
	}

	// Card labels: remap via labelMap
	for oldCardID, newCardID := range cardMap {
		rows, err := tx.Query(ctx,
			`SELECT label_id::text FROM card_labels WHERE card_id = $1`, oldCardID)
		if err != nil {
			return "", err
		}
		var oldIDs []string
		for rows.Next() {
			var id string
			if err := rows.Scan(&id); err != nil {
				rows.Close()
				return "", err
			}
			oldIDs = append(oldIDs, id)
		}
		rows.Close()
		for _, oldLID := range oldIDs {
			newLID, ok := labelMap[oldLID]
			if !ok {
				continue
			}
			if _, err := tx.Exec(ctx,
				`INSERT INTO card_labels (card_id, label_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
				newCardID, newLID); err != nil {
				return "", err
			}
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return "", err
	}
	return newBoardID, nil
}

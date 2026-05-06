package service

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

// CardCopier handles deep-copying a card into a target list.
// All inserts run in a single transaction.
type CardCopier struct {
	pool *pgxpool.Pool
}

func NewCardCopier(pool *pgxpool.Pool) *CardCopier {
	return &CardCopier{pool: pool}
}

type CopyOptions struct {
	IncludeDescription bool
	IncludeChecklists  bool
	IncludeAttachments bool
	IncludeComments    bool
	IncludeLabels      bool
	IncludeAssignees   bool
	IncludeDueDate     bool
	IncludePriority    bool
}

// Copy duplicates `sourceCardID` into `targetListID` (which can be on a
// different board). Returns the new card id. Labels are remapped by name +
// color: a matching label on the target board is reused; otherwise the
// label is dropped (cross-board labels would create dangling references).
func (c *CardCopier) Copy(
	ctx context.Context,
	sourceCardID, targetListID, actorUserID string,
	opts CopyOptions,
) (string, error) {
	tx, err := c.pool.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer tx.Rollback(ctx)

	// Read source card
	var (
		title       string
		description pgtype.Text
		dueDate     pgtype.Timestamptz
		priority    pgtype.Text
	)
	if err := tx.QueryRow(ctx,
		`SELECT title, description, due_date, priority FROM cards WHERE id = $1 AND deleted_at IS NULL`,
		sourceCardID).Scan(&title, &description, &dueDate, &priority); err != nil {
		return "", fmt.Errorf("source card not found: %w", err)
	}

	if !opts.IncludeDescription {
		description = pgtype.Text{}
	}
	if !opts.IncludeDueDate {
		dueDate = pgtype.Timestamptz{}
	}
	if !opts.IncludePriority {
		priority = pgtype.Text{}
	}

	// Compute next position in target list
	var maxPos *float64
	tx.QueryRow(ctx,
		`SELECT MAX(position) FROM cards WHERE list_id = $1 AND deleted_at IS NULL AND is_archived = FALSE`,
		targetListID).Scan(&maxPos)
	pos := 1024.0
	if maxPos != nil {
		pos = *maxPos + 1024
	}

	// Insert new card
	var newCardID string
	if err := tx.QueryRow(ctx, `
		INSERT INTO cards (list_id, title, description, position, due_date, priority, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id`,
		targetListID, title, description, pos, dueDate, priority, actorUserID,
	).Scan(&newCardID); err != nil {
		return "", err
	}

	// Resolve target board id (used for label remapping)
	var targetBoardID string
	if err := tx.QueryRow(ctx,
		`SELECT board_id::text FROM lists WHERE id = $1`, targetListID).Scan(&targetBoardID); err != nil {
		return "", err
	}

	// Resolve source board id
	var sourceBoardID string
	if err := tx.QueryRow(ctx, `
		SELECT l.board_id::text FROM cards c JOIN lists l ON c.list_id = l.id WHERE c.id = $1`,
		sourceCardID).Scan(&sourceBoardID); err != nil {
		return "", err
	}

	// Labels: when same board, reuse ids directly. Otherwise, remap by (name, color).
	if opts.IncludeLabels {
		if sourceBoardID == targetBoardID {
			if _, err := tx.Exec(ctx, `
				INSERT INTO card_labels (card_id, label_id)
				SELECT $1, label_id FROM card_labels WHERE card_id = $2`,
				newCardID, sourceCardID); err != nil {
				return "", err
			}
		} else {
			if _, err := tx.Exec(ctx, `
				INSERT INTO card_labels (card_id, label_id)
				SELECT $1, target.id
				FROM card_labels cl
				JOIN labels src    ON cl.label_id = src.id
				JOIN labels target ON target.board_id = $3
				                   AND target.name  = src.name
				                   AND target.color = src.color
				WHERE cl.card_id = $2`,
				newCardID, sourceCardID, targetBoardID); err != nil {
				return "", err
			}
		}
	}

	if opts.IncludeAssignees {
		if _, err := tx.Exec(ctx, `
			INSERT INTO card_assignees (card_id, user_id)
			SELECT $1, user_id FROM card_assignees WHERE card_id = $2`,
			newCardID, sourceCardID); err != nil {
			return "", err
		}
	}

	if opts.IncludeChecklists {
		// Map old checklist ids to new ones via WITH ... RETURNING
		rows, err := tx.Query(ctx, `
			WITH inserted AS (
				INSERT INTO checklists (card_id, title, position)
				SELECT $1, title, position FROM checklists WHERE card_id = $2
				RETURNING id, title, position
			)
			SELECT (SELECT id FROM checklists WHERE card_id = $2 AND title = i.title AND position = i.position LIMIT 1), i.id
			FROM inserted i`,
			newCardID, sourceCardID)
		if err != nil {
			return "", err
		}
		oldToNew := make(map[string]string)
		for rows.Next() {
			var oldID, newID string
			if err := rows.Scan(&oldID, &newID); err != nil {
				rows.Close()
				return "", err
			}
			oldToNew[oldID] = newID
		}
		rows.Close()

		// Copy items pointing at the new checklists
		for oldID, newID := range oldToNew {
			if _, err := tx.Exec(ctx, `
				INSERT INTO checklist_items (checklist_id, text, is_complete, position, due_date, assignee_id)
				SELECT $1, text, is_complete, position, due_date, assignee_id
				FROM checklist_items WHERE checklist_id = $2`,
				newID, oldID); err != nil {
				return "", err
			}
		}
	}

	if opts.IncludeAttachments {
		// URL attachments are safe to clone; file attachments share the
		// underlying storage_key (same blob), uploader becomes the actor.
		if _, err := tx.Exec(ctx, `
			INSERT INTO attachments (card_id, uploader_id, kind, filename, mime_type, size_bytes, storage_key, url)
			SELECT $1, $2, kind, filename, mime_type, size_bytes, storage_key, url
			FROM attachments WHERE card_id = $3`,
			newCardID, actorUserID, sourceCardID); err != nil {
			return "", err
		}
	}

	if opts.IncludeComments {
		if _, err := tx.Exec(ctx, `
			INSERT INTO card_comments (card_id, user_id, body)
			SELECT $1, user_id, body FROM card_comments WHERE card_id = $2 ORDER BY created_at`,
			newCardID, sourceCardID); err != nil {
			return "", err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return "", err
	}
	return newCardID, nil
}

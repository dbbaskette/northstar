package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type CustomFieldRepo struct {
	pool *pgxpool.Pool
}

func NewCustomFieldRepo(pool *pgxpool.Pool) *CustomFieldRepo {
	return &CustomFieldRepo{pool: pool}
}

type CustomFieldDef struct {
	ID          pgtype.UUID     `json:"id"`
	BoardID     pgtype.UUID     `json:"board_id"`
	Name        string          `json:"name"`
	Type        string          `json:"type"`
	Options     json.RawMessage `json:"options,omitempty"`
	Position    float64         `json:"position"`
	ShowOnFront bool            `json:"show_on_front"`
	CreatedAt   time.Time       `json:"created_at"`
}

type CustomFieldValue struct {
	CardID     pgtype.UUID        `json:"card_id"`
	FieldDefID pgtype.UUID        `json:"field_def_id"`
	Text       pgtype.Text        `json:"value_text,omitempty"`
	Number     pgtype.Float8      `json:"value_number,omitempty"`
	Date       pgtype.Timestamptz `json:"value_date,omitempty"`
	Bool       pgtype.Bool        `json:"value_bool,omitempty"`
}

func (r *CustomFieldRepo) CreateDef(ctx context.Context, boardID, name, ftype string, options json.RawMessage, showOnFront bool) (*CustomFieldDef, error) {
	var maxPos *float64
	r.pool.QueryRow(ctx,
		`SELECT MAX(position) FROM custom_field_defs WHERE board_id = $1`, boardID,
	).Scan(&maxPos)
	pos := 1024.0
	if maxPos != nil {
		pos = *maxPos + 1024
	}

	def := &CustomFieldDef{
		Name:        name,
		Type:        ftype,
		Options:     options,
		Position:    pos,
		ShowOnFront: showOnFront,
	}
	def.BoardID.Scan(boardID)

	if err := r.pool.QueryRow(ctx, `
		INSERT INTO custom_field_defs (board_id, name, type, options_json, position, show_on_front)
		VALUES ($1, $2, $3::custom_field_type, $4, $5, $6)
		RETURNING id, created_at`,
		boardID, name, ftype, options, pos, showOnFront,
	).Scan(&def.ID, &def.CreatedAt); err != nil {
		return nil, err
	}
	return def, nil
}

func (r *CustomFieldRepo) ListDefsByBoard(ctx context.Context, boardID string) ([]CustomFieldDef, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, board_id, name, type::text, options_json, position, show_on_front, created_at
		FROM custom_field_defs WHERE board_id = $1 ORDER BY position`, boardID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []CustomFieldDef
	for rows.Next() {
		var d CustomFieldDef
		if err := rows.Scan(&d.ID, &d.BoardID, &d.Name, &d.Type, &d.Options,
			&d.Position, &d.ShowOnFront, &d.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}

func (r *CustomFieldRepo) UpdateDef(ctx context.Context, id, name string, options json.RawMessage, showOnFront bool) error {
	ct, err := r.pool.Exec(ctx,
		`UPDATE custom_field_defs SET name = $2, options_json = $3, show_on_front = $4 WHERE id = $1`,
		id, name, options, showOnFront)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return fmt.Errorf("field not found")
	}
	return nil
}

func (r *CustomFieldRepo) DeleteDef(ctx context.Context, id string) error {
	ct, err := r.pool.Exec(ctx, `DELETE FROM custom_field_defs WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return fmt.Errorf("field not found")
	}
	return nil
}

// SetValue upserts a value row, accepting raw JSON to dispatch to the
// right column based on the field's type.
func (r *CustomFieldRepo) SetValue(ctx context.Context, cardID, fieldDefID string, raw json.RawMessage) error {
	// Read field type
	var ftype string
	if err := r.pool.QueryRow(ctx,
		`SELECT type::text FROM custom_field_defs WHERE id = $1`, fieldDefID).Scan(&ftype); err != nil {
		return err
	}

	var (
		valueText   pgtype.Text
		valueNumber pgtype.Float8
		valueDate   pgtype.Timestamptz
		valueBool   pgtype.Bool
	)

	switch ftype {
	case "text", "dropdown":
		var s string
		if err := json.Unmarshal(raw, &s); err != nil {
			return fmt.Errorf("expected string: %w", err)
		}
		if s != "" {
			valueText = pgtype.Text{String: s, Valid: true}
		}
	case "number":
		var n float64
		if err := json.Unmarshal(raw, &n); err != nil {
			return fmt.Errorf("expected number: %w", err)
		}
		valueNumber = pgtype.Float8{Float64: n, Valid: true}
	case "date":
		var s string
		if err := json.Unmarshal(raw, &s); err != nil {
			return fmt.Errorf("expected ISO date string: %w", err)
		}
		if s != "" {
			t, err := time.Parse(time.RFC3339, s)
			if err != nil {
				return fmt.Errorf("invalid date: %w", err)
			}
			valueDate = pgtype.Timestamptz{Time: t, Valid: true}
		}
	case "checkbox":
		var b bool
		if err := json.Unmarshal(raw, &b); err != nil {
			return fmt.Errorf("expected boolean: %w", err)
		}
		valueBool = pgtype.Bool{Bool: b, Valid: true}
	default:
		return fmt.Errorf("unknown field type: %s", ftype)
	}

	_, err := r.pool.Exec(ctx, `
		INSERT INTO custom_field_values (card_id, field_def_id, value_text, value_number, value_date, value_bool)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (card_id, field_def_id) DO UPDATE SET
			value_text   = EXCLUDED.value_text,
			value_number = EXCLUDED.value_number,
			value_date   = EXCLUDED.value_date,
			value_bool   = EXCLUDED.value_bool`,
		cardID, fieldDefID, valueText, valueNumber, valueDate, valueBool)
	return err
}

func (r *CustomFieldRepo) ValuesForCard(ctx context.Context, cardID string) ([]CustomFieldValue, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT card_id, field_def_id, value_text, value_number, value_date, value_bool
		FROM custom_field_values WHERE card_id = $1`, cardID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []CustomFieldValue
	for rows.Next() {
		var v CustomFieldValue
		if err := rows.Scan(&v.CardID, &v.FieldDefID, &v.Text, &v.Number, &v.Date, &v.Bool); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}

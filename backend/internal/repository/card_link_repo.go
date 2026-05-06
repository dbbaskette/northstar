package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type CardLink struct {
	ID           string    `json:"id"`
	FromCardID   string    `json:"from_card_id"`
	ToCardID     string    `json:"to_card_id"`
	RelationType string    `json:"relation_type"`
	CreatedAt    time.Time `json:"created_at"`

	// Hydrated for display.
	OtherCardID    string `json:"other_card_id,omitempty"`
	OtherCardTitle string `json:"other_card_title,omitempty"`
	OtherBoardID   string `json:"other_board_id,omitempty"`
	OtherBoardName string `json:"other_board_name,omitempty"`
	// Direction reads from the perspective of the queried card —
	// "outgoing" or "incoming". Lets the UI flip the verb (blocks
	// vs. blocked by) without needing a second query.
	Direction string `json:"direction"`
}

type CardLinkRepo struct {
	pool *pgxpool.Pool
}

func NewCardLinkRepo(pool *pgxpool.Pool) *CardLinkRepo {
	return &CardLinkRepo{pool: pool}
}

var validRelationTypes = map[string]bool{
	"related":   true,
	"duplicate": true,
	"blocks":    true,
}

func (r *CardLinkRepo) Create(ctx context.Context, fromCardID, toCardID, relationType, createdBy string) (*CardLink, error) {
	if !validRelationTypes[relationType] {
		return nil, fmt.Errorf("invalid relation type %q", relationType)
	}
	if fromCardID == toCardID {
		return nil, fmt.Errorf("a card cannot link to itself")
	}

	link := &CardLink{}
	err := r.pool.QueryRow(ctx, `
		INSERT INTO card_links (from_card_id, to_card_id, relation_type, created_by)
		VALUES ($1, $2, $3::card_link_type, NULLIF($4, '')::uuid)
		ON CONFLICT (from_card_id, to_card_id, relation_type) DO UPDATE
		    SET relation_type = EXCLUDED.relation_type
		RETURNING id::text, from_card_id::text, to_card_id::text, relation_type::text, created_at`,
		fromCardID, toCardID, relationType, createdBy,
	).Scan(&link.ID, &link.FromCardID, &link.ToCardID, &link.RelationType, &link.CreatedAt)
	return link, err
}

func (r *CardLinkRepo) Delete(ctx context.Context, linkID string) error {
	ct, err := r.pool.Exec(ctx, `DELETE FROM card_links WHERE id = $1`, linkID)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return fmt.Errorf("link not found")
	}
	return nil
}

// ForCard returns every link touching `cardID` in either direction.
// Each row carries Direction so the UI can render "blocks X" vs.
// "blocked by Y" without juggling two queries.
func (r *CardLinkRepo) ForCard(ctx context.Context, cardID string) ([]CardLink, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT cl.id::text, cl.from_card_id::text, cl.to_card_id::text,
		       cl.relation_type::text, cl.created_at,
		       CASE WHEN cl.from_card_id = $1 THEN 'outgoing' ELSE 'incoming' END AS direction,
		       other.id::text, other.title,
		       l.board_id::text, b.name
		FROM card_links cl
		JOIN cards other
		    ON other.id = CASE WHEN cl.from_card_id = $1
		                       THEN cl.to_card_id ELSE cl.from_card_id END
		JOIN lists l ON l.id = other.list_id
		JOIN boards b ON b.id = l.board_id
		WHERE cl.from_card_id = $1 OR cl.to_card_id = $1
		ORDER BY cl.created_at DESC`, cardID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []CardLink{}
	for rows.Next() {
		var l CardLink
		if err := rows.Scan(
			&l.ID, &l.FromCardID, &l.ToCardID, &l.RelationType, &l.CreatedAt,
			&l.Direction,
			&l.OtherCardID, &l.OtherCardTitle,
			&l.OtherBoardID, &l.OtherBoardName,
		); err != nil {
			return nil, err
		}
		out = append(out, l)
	}
	return out, rows.Err()
}

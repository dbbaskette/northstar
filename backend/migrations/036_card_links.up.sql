-- Cross-board card relationships. Bidirectional in display: a "blocks"
-- link from A→B is rendered on B as "blocked by A".
CREATE TYPE card_link_type AS ENUM ('related', 'duplicate', 'blocks');

CREATE TABLE card_links (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    from_card_id    UUID            NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    to_card_id      UUID            NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    relation_type   card_link_type  NOT NULL,
    created_by      UUID            REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    UNIQUE (from_card_id, to_card_id, relation_type),
    CHECK (from_card_id <> to_card_id)
);

CREATE INDEX idx_card_links_from ON card_links (from_card_id);
CREATE INDEX idx_card_links_to ON card_links (to_card_id);

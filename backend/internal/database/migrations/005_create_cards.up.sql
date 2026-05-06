CREATE TABLE cards (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    list_id     UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
    title       VARCHAR(500) NOT NULL,
    description TEXT,
    position    DOUBLE PRECISION NOT NULL,
    due_date    TIMESTAMPTZ,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_by  UUID NOT NULL REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ
);

CREATE INDEX idx_cards_list_position ON cards(list_id, position)
    WHERE deleted_at IS NULL AND is_archived = FALSE;

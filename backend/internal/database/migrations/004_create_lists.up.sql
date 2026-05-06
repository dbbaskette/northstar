CREATE TABLE lists (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    board_id    UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    name        VARCHAR(200) NOT NULL,
    position    DOUBLE PRECISION NOT NULL,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lists_board_position ON lists(board_id, position)
    WHERE is_archived = FALSE;

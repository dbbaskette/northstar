CREATE TABLE labels (
    id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    board_id  UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    name      VARCHAR(100) NOT NULL,
    color     VARCHAR(30) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_labels_board ON labels(board_id);

CREATE TABLE card_labels (
    card_id  UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    label_id UUID NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
    PRIMARY KEY (card_id, label_id)
);

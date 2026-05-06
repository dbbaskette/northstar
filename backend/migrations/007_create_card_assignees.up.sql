CREATE TABLE card_assignees (
    card_id     UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (card_id, user_id)
);

CREATE TABLE card_comments (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    card_id    UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id),
    body       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_comments_card ON card_comments(card_id, created_at);

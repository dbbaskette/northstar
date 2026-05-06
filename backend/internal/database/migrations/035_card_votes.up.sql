CREATE TABLE card_votes (
    card_id    UUID         NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    user_id    UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    PRIMARY KEY (card_id, user_id)
);

CREATE INDEX idx_card_votes_card ON card_votes (card_id);

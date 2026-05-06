CREATE TABLE comment_reactions (
    comment_id UUID NOT NULL REFERENCES card_comments(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji      VARCHAR(16) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (comment_id, user_id, emoji)
);

CREATE INDEX idx_comment_reactions_comment ON comment_reactions(comment_id);

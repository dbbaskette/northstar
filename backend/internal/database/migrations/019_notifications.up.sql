CREATE TABLE notifications (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type            VARCHAR(64) NOT NULL,
    payload         JSONB NOT NULL,
    source_card_id  UUID REFERENCES cards(id) ON DELETE CASCADE,
    source_board_id UUID REFERENCES boards(id) ON DELETE CASCADE,
    is_read         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX idx_notifications_user_recent ON notifications(user_id, created_at DESC);

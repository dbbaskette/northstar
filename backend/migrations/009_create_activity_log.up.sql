CREATE TABLE activity_log (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    board_id    UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id),
    action      VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id   UUID NOT NULL,
    metadata    JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activity_board_time ON activity_log(board_id, created_at DESC);

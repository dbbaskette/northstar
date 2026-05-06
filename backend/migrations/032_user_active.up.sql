ALTER TABLE users
    ADD COLUMN is_active        BOOLEAN     NOT NULL DEFAULT TRUE,
    ADD COLUMN deactivated_at   TIMESTAMPTZ;

CREATE INDEX idx_users_is_active ON users (is_active) WHERE is_active = FALSE;

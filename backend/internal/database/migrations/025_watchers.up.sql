CREATE TYPE watch_target AS ENUM ('card', 'list', 'board');

CREATE TABLE watchers (
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_type watch_target NOT NULL,
    target_id   UUID NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, target_type, target_id)
);

CREATE INDEX idx_watchers_target ON watchers(target_type, target_id);

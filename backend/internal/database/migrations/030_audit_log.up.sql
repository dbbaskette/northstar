-- audit_log captures security-relevant events (logins, role changes,
-- permission changes, deletions) separately from the per-board
-- activity_log. Append-only at the application layer — handlers
-- only INSERT and SELECT.
CREATE TABLE audit_log (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id   UUID         REFERENCES users(id) ON DELETE SET NULL,
    action          VARCHAR(64)  NOT NULL,
    target_type     VARCHAR(32),
    target_id       VARCHAR(64),
    ip              VARCHAR(64),
    user_agent      TEXT,
    metadata        JSONB,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_created_at ON audit_log (created_at DESC);
CREATE INDEX idx_audit_log_actor ON audit_log (actor_user_id);
CREATE INDEX idx_audit_log_action ON audit_log (action);

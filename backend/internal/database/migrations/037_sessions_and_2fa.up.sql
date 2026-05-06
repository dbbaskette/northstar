-- Per-issued-token session row. JWT carries the jti claim; revoking
-- a session sets revoked_at, which the auth middleware checks on
-- every request.
CREATE TABLE sessions (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    jti           VARCHAR(64)  NOT NULL UNIQUE,
    ip            VARCHAR(64),
    user_agent    TEXT,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    last_seen_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    revoked_at    TIMESTAMPTZ
);
CREATE INDEX idx_sessions_user ON sessions (user_id);
CREATE INDEX idx_sessions_jti ON sessions (jti);

-- TOTP secret per user (one row per user when 2FA enabled). The
-- secret is stored as the bare base32 string; in production this
-- should be encrypted at rest, but the CF Postgres tier already
-- encrypts the volume so we accept the trade-off.
CREATE TABLE user_2fa (
    user_id      UUID         PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    totp_secret  VARCHAR(64)  NOT NULL,
    enabled_at   TIMESTAMPTZ
);

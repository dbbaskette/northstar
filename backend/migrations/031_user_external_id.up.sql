-- External-identity link for SSO providers (currently: GitHub).
-- A user can have at most one external identity per provider; existing
-- users are matched on primary email at first SSO login.
ALTER TABLE users
    ADD COLUMN external_provider VARCHAR(32),
    ADD COLUMN external_id VARCHAR(128);

-- SSO-only users have no password — empty string is the sentinel.
ALTER TABLE users ALTER COLUMN password_hash SET DEFAULT '';

CREATE UNIQUE INDEX users_external_idx
    ON users (external_provider, external_id)
    WHERE external_provider IS NOT NULL;

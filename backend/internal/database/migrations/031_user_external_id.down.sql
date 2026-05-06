DROP INDEX IF EXISTS users_external_idx;
ALTER TABLE users ALTER COLUMN password_hash DROP DEFAULT;
ALTER TABLE users
    DROP COLUMN external_provider,
    DROP COLUMN external_id;

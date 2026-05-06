DROP INDEX IF EXISTS idx_users_is_active;
ALTER TABLE users
    DROP COLUMN is_active,
    DROP COLUMN deactivated_at;

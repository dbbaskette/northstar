DROP INDEX IF EXISTS idx_boards_template;
ALTER TABLE boards DROP COLUMN IF EXISTS is_template;

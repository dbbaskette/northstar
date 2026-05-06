DROP INDEX IF EXISTS idx_board_members_user;
ALTER TABLE boards DROP COLUMN IF EXISTS visibility;
DROP TYPE IF EXISTS board_visibility;

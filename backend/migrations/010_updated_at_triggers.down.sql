DROP TRIGGER IF EXISTS set_updated_at ON card_comments;
DROP TRIGGER IF EXISTS set_updated_at ON cards;
DROP TRIGGER IF EXISTS set_updated_at ON lists;
DROP TRIGGER IF EXISTS set_updated_at ON boards;
DROP TRIGGER IF EXISTS set_updated_at ON teams;
DROP TRIGGER IF EXISTS set_updated_at ON users;
DROP FUNCTION IF EXISTS trigger_set_updated_at();

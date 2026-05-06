DROP TRIGGER IF EXISTS cards_search_vector_trigger ON cards;
DROP FUNCTION IF EXISTS cards_search_vector_update();
DROP INDEX IF EXISTS idx_cards_search;
ALTER TABLE cards DROP COLUMN IF EXISTS search_vector;

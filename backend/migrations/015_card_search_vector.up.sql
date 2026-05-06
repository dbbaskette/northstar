ALTER TABLE cards ADD COLUMN search_vector tsvector;

CREATE INDEX idx_cards_search ON cards USING GIN(search_vector)
    WHERE deleted_at IS NULL AND is_archived = FALSE;

CREATE OR REPLACE FUNCTION cards_search_vector_update() RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cards_search_vector_trigger
    BEFORE INSERT OR UPDATE OF title, description ON cards
    FOR EACH ROW EXECUTE FUNCTION cards_search_vector_update();

UPDATE cards SET search_vector =
    setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(description, '')), 'B');

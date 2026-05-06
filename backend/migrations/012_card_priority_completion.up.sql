CREATE TYPE card_priority AS ENUM ('low', 'medium', 'high', 'urgent');

ALTER TABLE cards
    ADD COLUMN priority     card_priority,
    ADD COLUMN completed_at TIMESTAMPTZ;

CREATE INDEX idx_cards_completed ON cards(list_id, completed_at)
    WHERE deleted_at IS NULL AND is_archived = FALSE;

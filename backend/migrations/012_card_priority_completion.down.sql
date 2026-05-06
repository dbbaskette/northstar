ALTER TABLE cards
    DROP COLUMN IF EXISTS priority,
    DROP COLUMN IF EXISTS completed_at;

DROP TYPE IF EXISTS card_priority;

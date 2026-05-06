ALTER TABLE cards
    DROP COLUMN IF EXISTS cover_attachment_id,
    DROP COLUMN IF EXISTS cover_color,
    DROP COLUMN IF EXISTS cover_size;

DROP TYPE IF EXISTS card_cover_size;

CREATE TYPE card_cover_size AS ENUM ('half', 'full');

ALTER TABLE cards
    ADD COLUMN cover_attachment_id UUID REFERENCES attachments(id) ON DELETE SET NULL,
    ADD COLUMN cover_color         VARCHAR(20),
    ADD COLUMN cover_size          card_cover_size;

CREATE TYPE attachment_kind AS ENUM ('file', 'url');

CREATE TABLE attachments (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    card_id     UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    uploader_id UUID NOT NULL REFERENCES users(id),
    kind        attachment_kind NOT NULL,
    filename    VARCHAR(500) NOT NULL,
    mime_type   VARCHAR(255),
    size_bytes  BIGINT,
    storage_key VARCHAR(500),
    url         TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_attachments_card ON attachments(card_id, created_at DESC);

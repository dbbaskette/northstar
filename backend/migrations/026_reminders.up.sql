CREATE TABLE reminders (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    card_id       UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
    lead_minutes  INTEGER NOT NULL DEFAULT 1440,
    sent_at       TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (card_id, user_id, lead_minutes)
);

CREATE INDEX idx_reminders_pending ON reminders(card_id) WHERE sent_at IS NULL;

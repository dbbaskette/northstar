CREATE TABLE webhooks (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    board_id      UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    url           TEXT NOT NULL,
    secret        VARCHAR(64) NOT NULL,
    event_filters JSONB NOT NULL DEFAULT '[]'::jsonb,
    active        BOOLEAN NOT NULL DEFAULT TRUE,
    created_by    UUID NOT NULL REFERENCES users(id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_webhooks_board ON webhooks(board_id) WHERE active = TRUE;

CREATE TABLE webhook_deliveries (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    webhook_id    UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
    event         VARCHAR(64) NOT NULL,
    payload       JSONB NOT NULL,
    status        VARCHAR(20) NOT NULL DEFAULT 'pending',
    response_code INTEGER,
    response_body TEXT,
    attempts      INTEGER NOT NULL DEFAULT 0,
    queued_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    delivered_at  TIMESTAMPTZ,
    next_attempt  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_webhook_deliveries_pending ON webhook_deliveries(next_attempt)
    WHERE status IN ('pending', 'retrying');
CREATE INDEX idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id, queued_at DESC);

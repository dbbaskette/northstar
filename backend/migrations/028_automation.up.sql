CREATE TABLE automation_rules (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    board_id    UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    name        VARCHAR(200) NOT NULL,
    trigger     JSONB NOT NULL,
    actions     JSONB NOT NULL,
    enabled     BOOLEAN NOT NULL DEFAULT TRUE,
    created_by  UUID NOT NULL REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_automation_rules_board ON automation_rules(board_id, enabled);

CREATE TABLE automation_runs (
    id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_id   UUID NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
    status    VARCHAR(20) NOT NULL,
    log       TEXT,
    ran_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_automation_runs_rule ON automation_runs(rule_id, ran_at DESC);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON automation_rules
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TABLE checklists (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    card_id    UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    title      VARCHAR(200) NOT NULL,
    position   DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_checklists_card ON checklists(card_id, position);

CREATE TABLE checklist_items (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    checklist_id  UUID NOT NULL REFERENCES checklists(id) ON DELETE CASCADE,
    text          TEXT NOT NULL,
    is_complete   BOOLEAN NOT NULL DEFAULT FALSE,
    position      DOUBLE PRECISION NOT NULL,
    due_date      TIMESTAMPTZ,
    assignee_id   UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_checklist_items_checklist ON checklist_items(checklist_id, position);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON checklists
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON checklist_items
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

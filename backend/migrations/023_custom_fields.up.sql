CREATE TYPE custom_field_type AS ENUM ('text', 'number', 'date', 'checkbox', 'dropdown');

CREATE TABLE custom_field_defs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    board_id        UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    type            custom_field_type NOT NULL,
    options_json    JSONB,           -- dropdown options: ["a","b","c"]
    position        DOUBLE PRECISION NOT NULL,
    show_on_front   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_custom_field_defs_board ON custom_field_defs(board_id, position);

CREATE TABLE custom_field_values (
    card_id      UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    field_def_id UUID NOT NULL REFERENCES custom_field_defs(id) ON DELETE CASCADE,
    value_text   TEXT,
    value_number DOUBLE PRECISION,
    value_date   TIMESTAMPTZ,
    value_bool   BOOLEAN,
    PRIMARY KEY (card_id, field_def_id)
);

CREATE INDEX idx_custom_field_values_card ON custom_field_values(card_id);

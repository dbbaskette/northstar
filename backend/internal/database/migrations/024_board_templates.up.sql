ALTER TABLE boards ADD COLUMN is_template BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX idx_boards_template ON boards(team_id, is_template) WHERE deleted_at IS NULL;

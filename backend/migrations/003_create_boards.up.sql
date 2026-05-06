CREATE TABLE boards (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id     UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name        VARCHAR(200) NOT NULL,
    description TEXT,
    background  VARCHAR(50) DEFAULT '#0079BF',
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_by  UUID NOT NULL REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ
);

CREATE INDEX idx_boards_team ON boards(team_id) WHERE deleted_at IS NULL;

CREATE TABLE board_members (
    board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role     user_role NOT NULL DEFAULT 'member',
    PRIMARY KEY (board_id, user_id)
);

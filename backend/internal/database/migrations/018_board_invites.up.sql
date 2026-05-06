CREATE TABLE board_invites (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    board_id            UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    token               VARCHAR(64) UNIQUE NOT NULL,
    email               VARCHAR(255),
    role                user_role NOT NULL DEFAULT 'member',
    expires_at          TIMESTAMPTZ,
    created_by          UUID NOT NULL REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_at         TIMESTAMPTZ,
    accepted_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_board_invites_board ON board_invites(board_id) WHERE accepted_at IS NULL;
CREATE INDEX idx_board_invites_token ON board_invites(token);

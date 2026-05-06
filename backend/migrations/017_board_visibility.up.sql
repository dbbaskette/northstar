CREATE TYPE board_visibility AS ENUM ('team', 'private');

ALTER TABLE boards
    ADD COLUMN visibility board_visibility NOT NULL DEFAULT 'team';

CREATE INDEX idx_board_members_user ON board_members(user_id);

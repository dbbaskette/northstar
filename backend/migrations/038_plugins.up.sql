-- Plugin registry (workspace-wide). Plugins are external apps the
-- workspace admin opts in to; per-board enablement lives in
-- board_plugins.
CREATE TABLE plugins (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(128) NOT NULL,
    description   TEXT,
    manifest_url  TEXT         NOT NULL,
    iframe_url    TEXT         NOT NULL,
    version       VARCHAR(32)  NOT NULL DEFAULT '1.0.0',
    capabilities  JSONB        NOT NULL DEFAULT '[]'::jsonb,
    created_by    UUID         REFERENCES users(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (name)
);

CREATE TABLE board_plugins (
    board_id     UUID         NOT NULL REFERENCES boards(id)  ON DELETE CASCADE,
    plugin_id    UUID         NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
    config       JSONB        NOT NULL DEFAULT '{}'::jsonb,
    enabled_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    PRIMARY KEY (board_id, plugin_id)
);

CREATE INDEX idx_board_plugins_board ON board_plugins (board_id);

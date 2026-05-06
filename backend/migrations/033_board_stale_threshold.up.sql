ALTER TABLE boards
    ADD COLUMN stale_threshold_days INT NOT NULL DEFAULT 14;

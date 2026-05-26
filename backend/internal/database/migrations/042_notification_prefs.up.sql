-- Per-user opt-out map keyed by notification type. Empty/absent =
-- everything is on. An entry of false disables that type. Empty
-- object is the safe default — new users get all notifications.
ALTER TABLE users
    ADD COLUMN notification_prefs JSONB NOT NULL DEFAULT '{}'::jsonb;

-- When an admin pre-creates an account with a temp password, set this
-- flag. The user is forced through a password-change screen on first
-- login; the flag clears once they pick their own password.
ALTER TABLE users ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT FALSE;

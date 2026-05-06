-- New users land with approved_at NULL; an admin sets it via the
-- approval action. The very first user (bootstrap admin) gets
-- approved_at = NOW() at registration time.
ALTER TABLE users ADD COLUMN approved_at TIMESTAMPTZ;

-- Auto-approve everyone who already exists so the upgrade doesn't
-- lock current users out of their account.
UPDATE users SET approved_at = COALESCE(created_at, NOW()) WHERE approved_at IS NULL;

-- Bootstrap admin: if exactly one user exists at upgrade time, that's
-- the original sign-up — promote them. Mirrors the "first registration
-- becomes admin" path that fresh installs follow.
UPDATE users SET role = 'admin'
 WHERE (SELECT COUNT(*) FROM users) = 1
   AND role <> 'admin';

-- background was originally VARCHAR(50) for hex color codes. Image
-- URLs (e.g. /api/v1/boards/{uuid}/background?v=N) blow past that.
-- Switch to TEXT — Postgres stores both narrow and wide values
-- equally efficiently and there's no upper bound to fight.
ALTER TABLE boards ALTER COLUMN background TYPE TEXT;

-- Truncate any URL-shaped values back into the legacy 50-char limit.
UPDATE boards SET background = '#0079BF' WHERE LENGTH(background) > 50;
ALTER TABLE boards ALTER COLUMN background TYPE VARCHAR(50);

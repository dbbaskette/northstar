-- Optional schedule start for timeline/Gantt view. Defaults to NULL —
-- when a card has only a due_date, the timeline renders a one-day bar
-- ending on the due date.
ALTER TABLE cards ADD COLUMN start_date TIMESTAMPTZ;

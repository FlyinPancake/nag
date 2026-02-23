-- Revert: remove 'once_in_a_while' schedule type
-- Delete any chores using the once_in_a_while schedule first

PRAGMA foreign_keys = OFF;

DELETE FROM chores WHERE schedule_type = 'once_in_a_while';

CREATE TABLE chores_old (
    id BLOB PRIMARY KEY NOT NULL CHECK(length(id) = 16),
    name TEXT NOT NULL,
    description TEXT,
    schedule_type TEXT NOT NULL DEFAULT 'cron' CHECK(schedule_type IN ('cron', 'interval')),
    cron_schedule TEXT,
    interval_days INTEGER CHECK(interval_days IS NULL OR (interval_days >= 1 AND interval_days <= 365)),
    interval_time_hour INTEGER CHECK(interval_time_hour IS NULL OR (interval_time_hour >= 0 AND interval_time_hour <= 23)),
    interval_time_minute INTEGER CHECK(interval_time_minute IS NULL OR (interval_time_minute >= 0 AND interval_time_minute <= 59)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CHECK(
        (schedule_type = 'cron' AND cron_schedule IS NOT NULL) OR
        (schedule_type = 'interval' AND interval_days IS NOT NULL)
    )
);

INSERT INTO chores_old SELECT * FROM chores;

DROP TABLE chores;
ALTER TABLE chores_old RENAME TO chores;

PRAGMA foreign_keys = ON;

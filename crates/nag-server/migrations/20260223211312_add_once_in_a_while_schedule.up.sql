-- Add 'once_in_a_while' schedule type for tasks without strict recurring schedules.
-- SQLite doesn't support ALTER CHECK, so we recreate the table.

PRAGMA foreign_keys = OFF;

-- 1. Create new table with updated constraints
CREATE TABLE chores_new (
    id BLOB PRIMARY KEY NOT NULL CHECK(length(id) = 16),
    name TEXT NOT NULL,
    description TEXT,
    schedule_type TEXT NOT NULL DEFAULT 'cron' CHECK(schedule_type IN ('cron', 'interval', 'once_in_a_while')),
    cron_schedule TEXT,
    interval_days INTEGER CHECK(interval_days IS NULL OR (interval_days >= 1 AND interval_days <= 365)),
    interval_time_hour INTEGER CHECK(interval_time_hour IS NULL OR (interval_time_hour >= 0 AND interval_time_hour <= 23)),
    interval_time_minute INTEGER CHECK(interval_time_minute IS NULL OR (interval_time_minute >= 0 AND interval_time_minute <= 59)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CHECK(
        (schedule_type = 'cron' AND cron_schedule IS NOT NULL) OR
        (schedule_type = 'interval' AND interval_days IS NOT NULL) OR
        (schedule_type = 'once_in_a_while')
    )
);

-- 2. Copy existing data
INSERT INTO chores_new SELECT * FROM chores;

-- 3. Swap tables
DROP TABLE chores;
ALTER TABLE chores_new RENAME TO chores;

PRAGMA foreign_keys = ON;

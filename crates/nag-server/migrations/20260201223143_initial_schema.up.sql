-- Chores: recurring tasks
CREATE TABLE chores (
    id BLOB PRIMARY KEY NOT NULL CHECK(length(id) = 16),
    name TEXT NOT NULL,
    description TEXT,
    -- Schedule type: 'cron' for fixed schedules, 'interval' for relative schedules
    schedule_type TEXT NOT NULL DEFAULT 'cron' CHECK(schedule_type IN ('cron', 'interval')),
    -- For cron schedules (required when schedule_type = 'cron')
    cron_schedule TEXT,
    -- For interval schedules (required when schedule_type = 'interval')
    -- Number of days between occurrences (1-365)
    interval_days INTEGER CHECK(interval_days IS NULL OR (interval_days >= 1 AND interval_days <= 365)),
    -- Optional time of day for interval reminders (hour 0-23, minute 0-59)
    interval_time_hour INTEGER CHECK(interval_time_hour IS NULL OR (interval_time_hour >= 0 AND interval_time_hour <= 23)),
    interval_time_minute INTEGER CHECK(interval_time_minute IS NULL OR (interval_time_minute >= 0 AND interval_time_minute <= 59)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    -- Ensure schedule data is valid for the type
    CHECK(
        (schedule_type = 'cron' AND cron_schedule IS NOT NULL) OR
        (schedule_type = 'interval' AND interval_days IS NOT NULL)
    )
);

-- Completions: history of when chores were done
CREATE TABLE completions (
    id BLOB PRIMARY KEY NOT NULL CHECK(length(id) = 16),
    chore_id BLOB NOT NULL REFERENCES chores(id) ON DELETE CASCADE CHECK(length(chore_id) = 16),
    completed_at TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX idx_completions_chore_id ON completions(chore_id);
CREATE INDEX idx_completions_completed_at ON completions(completed_at);

-- Tags
CREATE TABLE tags (
    id BLOB PRIMARY KEY NOT NULL CHECK(length(id) = 16),
    name TEXT NOT NULL UNIQUE,
    color TEXT,
    created_at TEXT NOT NULL
);

-- Junction table for chore <-> tag many-to-many
CREATE TABLE chore_tags (
    chore_id BLOB NOT NULL REFERENCES chores(id) ON DELETE CASCADE CHECK(length(chore_id) = 16),
    tag_id BLOB NOT NULL REFERENCES tags(id) ON DELETE CASCADE CHECK(length(tag_id) = 16),
    PRIMARY KEY (chore_id, tag_id)
);

CREATE INDEX idx_chore_tags_tag_id ON chore_tags(tag_id);

-- Users: OIDC-authenticated users
CREATE TABLE users (
    id BLOB PRIMARY KEY NOT NULL CHECK(length(id) = 16),
    oidc_issuer TEXT NOT NULL,
    oidc_subject TEXT NOT NULL,
    email TEXT,
    name TEXT,
    picture TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(oidc_issuer, oidc_subject)
);

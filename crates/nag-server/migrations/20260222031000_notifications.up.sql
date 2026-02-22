-- Notification events represent distinct occurrences to notify about.
CREATE TABLE notification_events (
    id BLOB PRIMARY KEY NOT NULL CHECK(length(id) = 16),
    chore_id BLOB NOT NULL REFERENCES chores(id) ON DELETE CASCADE CHECK(length(chore_id) = 16),
    event_type TEXT NOT NULL CHECK(event_type IN ('due')),
    due_at TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(chore_id, event_type, due_at)
);

CREATE INDEX idx_notification_events_due_at ON notification_events(due_at);

-- Delivery attempts for each channel (telegram now, extensible later).
CREATE TABLE notification_deliveries (
    id BLOB PRIMARY KEY NOT NULL CHECK(length(id) = 16),
    event_id BLOB NOT NULL REFERENCES notification_events(id) ON DELETE CASCADE CHECK(length(event_id) = 16),
    channel TEXT NOT NULL CHECK(channel IN ('telegram')),
    status TEXT NOT NULL CHECK(status IN ('pending', 'failed', 'delivered')),
    attempt_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    last_attempted_at TEXT,
    delivered_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(event_id, channel)
);

CREATE INDEX idx_notification_deliveries_status ON notification_deliveries(status, attempt_count);

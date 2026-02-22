use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

/// Schedule type for chores
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type, ToSchema)]
#[serde(rename_all = "snake_case")]
#[sqlx(type_name = "TEXT", rename_all = "snake_case")]
pub enum ScheduleType {
    /// Fixed schedule based on cron expression (e.g., "every Monday at 9 AM")
    Cron,
    /// Relative schedule based on interval from last completion (e.g., "every 30 days")
    Interval,
}

/// A recurring chore/task
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct Chore {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub schedule_type: ScheduleType,
    pub cron_schedule: Option<String>,
    pub interval_days: Option<i32>,
    pub interval_time_hour: Option<i32>,
    pub interval_time_minute: Option<i32>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// A completion record for a chore
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct Completion {
    pub id: Uuid,
    pub chore_id: Uuid,
    pub completed_at: DateTime<Utc>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// Chore with its last completion time (for list queries)
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct ChoreWithLastCompletion {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub schedule_type: ScheduleType,
    pub cron_schedule: Option<String>,
    pub interval_days: Option<i32>,
    pub interval_time_hour: Option<i32>,
    pub interval_time_minute: Option<i32>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub last_completed_at: Option<DateTime<Utc>>,
}

/// A tag for categorizing chores
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct Tag {
    pub id: Uuid,
    pub name: String,
    pub color: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// An authenticated user (from OIDC)
#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct User {
    pub id: Uuid,
    pub oidc_issuer: String,
    pub oidc_subject: String,
    pub email: Option<String>,
    pub name: Option<String>,
    pub picture: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Notification event type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[serde(rename_all = "snake_case")]
#[sqlx(type_name = "TEXT", rename_all = "snake_case")]
pub enum NotificationEventType {
    Due,
}

/// Notification delivery channel
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[serde(rename_all = "snake_case")]
#[sqlx(type_name = "TEXT", rename_all = "snake_case")]
pub enum NotificationChannel {
    Telegram,
}

/// Notification delivery status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[serde(rename_all = "snake_case")]
#[sqlx(type_name = "TEXT", rename_all = "snake_case")]
pub enum NotificationDeliveryStatus {
    Pending,
    Failed,
    Delivered,
}

/// A unique notification event (deduplicated by chore + event + due time)
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct NotificationEvent {
    pub id: Uuid,
    pub chore_id: Uuid,
    pub event_type: NotificationEventType,
    pub due_at: DateTime<Utc>,
    pub title: String,
    pub body: String,
    pub created_at: DateTime<Utc>,
}

/// Delivery state for a notification event on a specific channel
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct NotificationDelivery {
    pub id: Uuid,
    pub event_id: Uuid,
    pub channel: NotificationChannel,
    pub status: NotificationDeliveryStatus,
    pub attempt_count: i32,
    pub last_error: Option<String>,
    pub last_attempted_at: Option<DateTime<Utc>>,
    pub delivered_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

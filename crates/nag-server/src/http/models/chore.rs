use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::db::models::{Chore, ChoreWithLastCompletion, Completion, ScheduleType, Tag};
use crate::services::ChoreWithDueInfo;

use super::tag::TagResponse;

// ============================================================================
// Request DTOs
// ============================================================================

/// Schedule specification for creating/updating chores
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(tag = "schedule_type", rename_all = "snake_case")]
pub enum ScheduleInput {
    /// Fixed schedule based on cron expression
    Cron {
        /// Cron schedule expression (e.g., "0 9 * * 1" for every Monday at 9am)
        cron_schedule: String,
    },
    /// Relative schedule based on interval from last completion
    Interval {
        /// Number of days between occurrences (1-365)
        interval_days: i32,
        /// Hour of day for reminder (0-23, optional)
        #[serde(default)]
        interval_time_hour: Option<i32>,
        /// Minute of hour for reminder (0-59, optional)
        #[serde(default)]
        interval_time_minute: Option<i32>,
    },
}

/// Request body for creating a new chore
#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateChoreRequest {
    /// Name of the chore
    pub name: String,
    /// Optional description
    pub description: Option<String>,
    /// Schedule specification (either cron or interval)
    #[serde(flatten)]
    pub schedule: ScheduleInput,
    /// Optional list of tag names to assign
    #[serde(default)]
    pub tags: Vec<String>,
}

/// Request body for updating a chore
#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdateChoreRequest {
    /// New name (optional)
    pub name: Option<String>,
    /// New description (optional, use null to clear)
    #[serde(default, deserialize_with = "deserialize_optional_field")]
    pub description: Option<Option<String>>,
    /// New schedule (optional, replaces the entire schedule)
    #[serde(default)]
    pub schedule: Option<ScheduleInput>,
    /// New set of tag names (optional, replaces all tags when present)
    pub tags: Option<Vec<String>>,
}

/// Custom deserializer that distinguishes between:
/// - Field absent → None
/// - Field present with null → Some(None)
/// - Field present with value → Some(Some(value))
fn deserialize_optional_field<'de, D>(deserializer: D) -> Result<Option<Option<String>>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    // If we get here, the field was present in the JSON
    // Now we just need to check if it was null or a value
    let value: Option<String> = Option::deserialize(deserializer)?;
    Ok(Some(value))
}

/// Request body for marking a chore as complete
#[derive(Debug, Deserialize, ToSchema)]
pub struct CompleteChoreRequest {
    /// Optional notes about this completion
    pub notes: Option<String>,
    /// When the chore was completed (defaults to now)
    pub completed_at: Option<DateTime<Utc>>,
}

/// Query parameters for listing chores
#[derive(Debug, Deserialize, ToSchema)]
pub struct ListChoresQuery {
    /// Cursor for pagination (UUID of last item)
    pub cursor: Option<Uuid>,
    /// Maximum number of items to return
    pub limit: Option<i64>,
    /// Filter by tag name
    pub tag: Option<String>,
}

/// Query parameters for listing completions
#[derive(Debug, Deserialize, ToSchema)]
pub struct ListCompletionsQuery {
    /// Cursor for pagination (UUID of last item)
    pub cursor: Option<Uuid>,
    /// Maximum number of items to return
    pub limit: Option<i64>,
}

/// Query parameters for due chores endpoint
#[derive(Debug, Deserialize, ToSchema)]
pub struct DueChoresQuery {
    /// Include upcoming chores (not yet overdue)
    #[serde(default)]
    pub include_upcoming: bool,
    /// Filter by tag name
    pub tag: Option<String>,
}

// ============================================================================
// Response DTOs
// ============================================================================

/// Response for a single chore
#[derive(Debug, Serialize, ToSchema)]
pub struct ChoreResponse {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    /// Schedule type: "cron" or "interval"
    pub schedule_type: ScheduleType,
    /// Cron expression (present when schedule_type is "cron")
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cron_schedule: Option<String>,
    /// Interval in days (present when schedule_type is "interval")
    #[serde(skip_serializing_if = "Option::is_none")]
    pub interval_days: Option<i32>,
    /// Hour of day for interval reminders (0-23)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub interval_time_hour: Option<i32>,
    /// Minute of hour for interval reminders (0-59)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub interval_time_minute: Option<i32>,
    pub last_completed_at: Option<DateTime<Utc>>,
    /// Tags assigned to this chore
    pub tags: Vec<TagResponse>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl ChoreResponse {
    pub fn from_chore(chore: Chore, tags: Vec<Tag>) -> Self {
        Self {
            id: chore.id,
            name: chore.name,
            description: chore.description,
            schedule_type: chore.schedule_type,
            cron_schedule: chore.cron_schedule,
            interval_days: chore.interval_days,
            interval_time_hour: chore.interval_time_hour,
            interval_time_minute: chore.interval_time_minute,
            last_completed_at: None,
            tags: tags.into_iter().map(TagResponse::from).collect(),
            created_at: chore.created_at,
            updated_at: chore.updated_at,
        }
    }

    pub fn from_chore_with_completion(chore: ChoreWithLastCompletion, tags: Vec<Tag>) -> Self {
        Self {
            id: chore.id,
            name: chore.name,
            description: chore.description,
            schedule_type: chore.schedule_type,
            cron_schedule: chore.cron_schedule,
            interval_days: chore.interval_days,
            interval_time_hour: chore.interval_time_hour,
            interval_time_minute: chore.interval_time_minute,
            last_completed_at: chore.last_completed_at,
            tags: tags.into_iter().map(TagResponse::from).collect(),
            created_at: chore.created_at,
            updated_at: chore.updated_at,
        }
    }
}

/// Response for a chore with due information
#[derive(Debug, Serialize, ToSchema)]
pub struct ChoreWithDueResponse {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    /// Schedule type: "cron" or "interval"
    pub schedule_type: ScheduleType,
    /// Cron expression (present when schedule_type is "cron")
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cron_schedule: Option<String>,
    /// Interval in days (present when schedule_type is "interval")
    #[serde(skip_serializing_if = "Option::is_none")]
    pub interval_days: Option<i32>,
    /// Hour of day for interval reminders (0-23)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub interval_time_hour: Option<i32>,
    /// Minute of hour for interval reminders (0-59)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub interval_time_minute: Option<i32>,
    pub last_completed_at: Option<DateTime<Utc>>,
    pub next_due: Option<DateTime<Utc>>,
    pub is_overdue: bool,
    /// Tags assigned to this chore
    pub tags: Vec<TagResponse>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl ChoreWithDueResponse {
    pub fn from_due_info(info: ChoreWithDueInfo, tags: Vec<Tag>) -> Self {
        Self {
            id: info.chore.id,
            name: info.chore.name,
            description: info.chore.description,
            schedule_type: info.chore.schedule_type,
            cron_schedule: info.chore.cron_schedule,
            interval_days: info.chore.interval_days,
            interval_time_hour: info.chore.interval_time_hour,
            interval_time_minute: info.chore.interval_time_minute,
            last_completed_at: info.chore.last_completed_at,
            next_due: info.next_due,
            is_overdue: info.is_overdue,
            tags: tags.into_iter().map(TagResponse::from).collect(),
            created_at: info.chore.created_at,
            updated_at: info.chore.updated_at,
        }
    }
}

/// Response for a completion record
#[derive(Debug, Serialize, ToSchema)]
pub struct CompletionResponse {
    pub id: Uuid,
    pub chore_id: Uuid,
    pub completed_at: DateTime<Utc>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
}

impl From<Completion> for CompletionResponse {
    fn from(completion: Completion) -> Self {
        Self {
            id: completion.id,
            chore_id: completion.chore_id,
            completed_at: completion.completed_at,
            notes: completion.notes,
            created_at: completion.created_at,
        }
    }
}

/// Paginated response wrapper
#[derive(Debug, Serialize, ToSchema)]
pub struct PaginatedResponse<T> {
    pub items: Vec<T>,
    pub next_cursor: Option<Uuid>,
}

impl<T> PaginatedResponse<T> {
    pub fn new(items: Vec<T>, next_cursor: Option<Uuid>) -> Self {
        Self { items, next_cursor }
    }
}

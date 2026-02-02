use chrono::Utc;
use sqlx::SqlitePool;
use uuid::Uuid;

use super::models::{Chore, ChoreWithLastCompletion, ScheduleType};

pub const DEFAULT_PAGE_SIZE: i64 = 20;

/// Parameters for creating a new chore
pub struct CreateChoreParams<'a> {
    pub name: &'a str,
    pub description: Option<&'a str>,
    pub schedule_type: ScheduleType,
    pub cron_schedule: Option<&'a str>,
    pub interval_days: Option<i32>,
    pub interval_time_hour: Option<i32>,
    pub interval_time_minute: Option<i32>,
}

/// Parameters for updating a chore's schedule
pub struct UpdateScheduleParams<'a> {
    pub schedule_type: ScheduleType,
    pub cron_schedule: Option<&'a str>,
    pub interval_days: Option<i32>,
    pub interval_time_hour: Option<i32>,
    pub interval_time_minute: Option<i32>,
}

pub struct ChoreRepository;

impl ChoreRepository {
    /// List all chores with cursor-based pagination
    pub async fn list(
        pool: &SqlitePool,
        cursor: Option<Uuid>,
        limit: Option<i64>,
    ) -> sqlx::Result<Vec<ChoreWithLastCompletion>> {
        let limit = limit.unwrap_or(DEFAULT_PAGE_SIZE);

        match cursor {
            Some(cursor_id) => {
                sqlx::query_as::<_, ChoreWithLastCompletion>(
                    r#"
                    SELECT
                        c.id, c.name, c.description,
                        c.schedule_type, c.cron_schedule,
                        c.interval_days, c.interval_time_hour, c.interval_time_minute,
                        c.created_at, c.updated_at,
                        (SELECT MAX(completed_at) FROM completions WHERE chore_id = c.id) as last_completed_at
                    FROM chores c
                    WHERE c.id > ?
                    ORDER BY c.id
                    LIMIT ?
                    "#,
                )
                .bind(cursor_id)
                .bind(limit)
                .fetch_all(pool)
                .await
            }
            None => {
                sqlx::query_as::<_, ChoreWithLastCompletion>(
                    r#"
                    SELECT
                        c.id, c.name, c.description,
                        c.schedule_type, c.cron_schedule,
                        c.interval_days, c.interval_time_hour, c.interval_time_minute,
                        c.created_at, c.updated_at,
                        (SELECT MAX(completed_at) FROM completions WHERE chore_id = c.id) as last_completed_at
                    FROM chores c
                    ORDER BY c.id
                    LIMIT ?
                    "#,
                )
                .bind(limit)
                .fetch_all(pool)
                .await
            }
        }
    }

    /// Get a single chore by ID with last completion time
    pub async fn get_by_id(
        pool: &SqlitePool,
        id: Uuid,
    ) -> sqlx::Result<Option<ChoreWithLastCompletion>> {
        sqlx::query_as::<_, ChoreWithLastCompletion>(
            r#"
            SELECT
                c.id, c.name, c.description,
                c.schedule_type, c.cron_schedule,
                c.interval_days, c.interval_time_hour, c.interval_time_minute,
                c.created_at, c.updated_at,
                (SELECT MAX(completed_at) FROM completions WHERE chore_id = c.id) as last_completed_at
            FROM chores c
            WHERE c.id = ?
            "#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await
    }

    /// Create a new chore
    pub async fn create(pool: &SqlitePool, params: CreateChoreParams<'_>) -> sqlx::Result<Chore> {
        let id = Uuid::new_v4();
        let now = Utc::now();

        sqlx::query(
            r#"
            INSERT INTO chores (
                id, name, description,
                schedule_type, cron_schedule,
                interval_days, interval_time_hour, interval_time_minute,
                created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(id)
        .bind(params.name)
        .bind(params.description)
        .bind(params.schedule_type)
        .bind(params.cron_schedule)
        .bind(params.interval_days)
        .bind(params.interval_time_hour)
        .bind(params.interval_time_minute)
        .bind(now)
        .bind(now)
        .execute(pool)
        .await?;

        Ok(Chore {
            id,
            name: params.name.to_string(),
            description: params.description.map(String::from),
            schedule_type: params.schedule_type,
            cron_schedule: params.cron_schedule.map(String::from),
            interval_days: params.interval_days,
            interval_time_hour: params.interval_time_hour,
            interval_time_minute: params.interval_time_minute,
            created_at: now,
            updated_at: now,
        })
    }

    /// Update an existing chore
    pub async fn update(
        pool: &SqlitePool,
        id: Uuid,
        name: Option<&str>,
        description: Option<Option<&str>>,
        schedule: Option<UpdateScheduleParams<'_>>,
    ) -> sqlx::Result<Option<Chore>> {
        let now = Utc::now();

        // First get the existing chore
        let existing = sqlx::query_as::<_, Chore>(
            r#"
            SELECT
                id, name, description,
                schedule_type, cron_schedule,
                interval_days, interval_time_hour, interval_time_minute,
                created_at, updated_at
            FROM chores WHERE id = ?
            "#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await?;

        let Some(mut chore) = existing else {
            return Ok(None);
        };

        // Apply updates
        if let Some(n) = name {
            chore.name = n.to_string();
        }
        if let Some(d) = description {
            chore.description = d.map(String::from);
        }
        if let Some(s) = schedule {
            chore.schedule_type = s.schedule_type;
            chore.cron_schedule = s.cron_schedule.map(String::from);
            chore.interval_days = s.interval_days;
            chore.interval_time_hour = s.interval_time_hour;
            chore.interval_time_minute = s.interval_time_minute;
        }
        chore.updated_at = now;

        sqlx::query(
            r#"
            UPDATE chores
            SET name = ?, description = ?,
                schedule_type = ?, cron_schedule = ?,
                interval_days = ?, interval_time_hour = ?, interval_time_minute = ?,
                updated_at = ?
            WHERE id = ?
            "#,
        )
        .bind(&chore.name)
        .bind(&chore.description)
        .bind(chore.schedule_type)
        .bind(&chore.cron_schedule)
        .bind(chore.interval_days)
        .bind(chore.interval_time_hour)
        .bind(chore.interval_time_minute)
        .bind(chore.updated_at)
        .bind(id)
        .execute(pool)
        .await?;

        Ok(Some(chore))
    }

    /// Delete a chore by ID
    pub async fn delete(pool: &SqlitePool, id: Uuid) -> sqlx::Result<bool> {
        let result = sqlx::query("DELETE FROM chores WHERE id = ?")
            .bind(id)
            .execute(pool)
            .await?;

        Ok(result.rows_affected() > 0)
    }

    /// Get all chores with their last completion (for due calculation)
    pub async fn list_all_with_last_completion(
        pool: &SqlitePool,
    ) -> sqlx::Result<Vec<ChoreWithLastCompletion>> {
        sqlx::query_as::<_, ChoreWithLastCompletion>(
            r#"
            SELECT
                c.id, c.name, c.description,
                c.schedule_type, c.cron_schedule,
                c.interval_days, c.interval_time_hour, c.interval_time_minute,
                c.created_at, c.updated_at,
                (SELECT MAX(completed_at) FROM completions WHERE chore_id = c.id) as last_completed_at
            FROM chores c
            ORDER BY c.name
            "#,
        )
        .fetch_all(pool)
        .await
    }
}

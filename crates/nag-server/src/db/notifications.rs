use chrono::{DateTime, Utc};
use sqlx::SqlitePool;
use uuid::Uuid;

use super::models::{NotificationChannel, NotificationDeliveryStatus, NotificationEventType};

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct PendingNotification {
    pub delivery_id: Uuid,
    pub event_id: Uuid,
    pub channel: NotificationChannel,
    pub attempt_count: i32,
    pub chore_id: Uuid,
    pub event_type: NotificationEventType,
    pub due_at: DateTime<Utc>,
    pub title: String,
    pub body: String,
}

pub struct NotificationRepository;

impl NotificationRepository {
    /// Create or fetch a unique due event and enqueue pending deliveries for channels.
    pub async fn upsert_due_event_with_deliveries(
        pool: &SqlitePool,
        chore_id: Uuid,
        due_at: DateTime<Utc>,
        title: &str,
        body: &str,
        channels: &[NotificationChannel],
    ) -> sqlx::Result<Uuid> {
        let now = Utc::now();
        let event_type = NotificationEventType::Due;
        let event_id = Uuid::new_v4();

        let insert = sqlx::query(
            r#"
            INSERT INTO notification_events (id, chore_id, event_type, due_at, title, body, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(chore_id, event_type, due_at) DO NOTHING
            "#,
        )
        .bind(event_id)
        .bind(chore_id)
        .bind(event_type)
        .bind(due_at)
        .bind(title)
        .bind(body)
        .bind(now)
        .execute(pool)
        .await?;

        let actual_event_id = if insert.rows_affected() > 0 {
            event_id
        } else {
            sqlx::query_scalar::<_, Uuid>(
                r#"
                SELECT id
                FROM notification_events
                WHERE chore_id = ? AND event_type = ? AND due_at = ?
                "#,
            )
            .bind(chore_id)
            .bind(event_type)
            .bind(due_at)
            .fetch_one(pool)
            .await?
        };

        for channel in channels {
            let delivery_id = Uuid::new_v4();
            sqlx::query(
                r#"
                INSERT INTO notification_deliveries (
                    id, event_id, channel, status, attempt_count,
                    last_error, last_attempted_at, delivered_at, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, 0, NULL, NULL, NULL, ?, ?)
                ON CONFLICT(event_id, channel) DO NOTHING
                "#,
            )
            .bind(delivery_id)
            .bind(actual_event_id)
            .bind(*channel)
            .bind(NotificationDeliveryStatus::Pending)
            .bind(now)
            .bind(now)
            .execute(pool)
            .await?;
        }

        Ok(actual_event_id)
    }

    /// Fetch pending and retryable failed deliveries.
    pub async fn list_pending(
        pool: &SqlitePool,
        limit: i64,
        max_attempts: i32,
    ) -> sqlx::Result<Vec<PendingNotification>> {
        sqlx::query_as::<_, PendingNotification>(
            r#"
            SELECT
                d.id AS delivery_id,
                d.event_id AS event_id,
                d.channel AS channel,
                d.attempt_count AS attempt_count,
                e.chore_id AS chore_id,
                e.event_type AS event_type,
                e.due_at AS due_at,
                e.title AS title,
                e.body AS body
            FROM notification_deliveries d
            INNER JOIN notification_events e ON e.id = d.event_id
            WHERE
                (d.status = ? OR d.status = ?)
                AND d.attempt_count < ?
            ORDER BY e.due_at ASC, d.created_at ASC
            LIMIT ?
            "#,
        )
        .bind(NotificationDeliveryStatus::Pending)
        .bind(NotificationDeliveryStatus::Failed)
        .bind(max_attempts)
        .bind(limit)
        .fetch_all(pool)
        .await
    }

    pub async fn mark_delivered(pool: &SqlitePool, delivery_id: Uuid) -> sqlx::Result<()> {
        let now = Utc::now();
        sqlx::query(
            r#"
            UPDATE notification_deliveries
            SET
                status = ?,
                delivered_at = ?,
                last_attempted_at = ?,
                last_error = NULL,
                updated_at = ?
            WHERE id = ?
            "#,
        )
        .bind(NotificationDeliveryStatus::Delivered)
        .bind(now)
        .bind(now)
        .bind(now)
        .bind(delivery_id)
        .execute(pool)
        .await?;
        Ok(())
    }

    pub async fn mark_failed(
        pool: &SqlitePool,
        delivery_id: Uuid,
        error: &str,
    ) -> sqlx::Result<()> {
        let now = Utc::now();
        sqlx::query(
            r#"
            UPDATE notification_deliveries
            SET
                status = ?,
                attempt_count = attempt_count + 1,
                last_error = ?,
                last_attempted_at = ?,
                updated_at = ?
            WHERE id = ?
            "#,
        )
        .bind(NotificationDeliveryStatus::Failed)
        .bind(error)
        .bind(now)
        .bind(now)
        .bind(delivery_id)
        .execute(pool)
        .await?;
        Ok(())
    }
}

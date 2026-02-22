mod common;

use chrono::Utc;
use nag_server::db::{
    self, ChoreRepository, NotificationRepository,
    chores::CreateChoreParams,
    models::{NotificationChannel, ScheduleType},
};

async fn create_chore(pool: &sqlx::SqlitePool, name: &str) -> uuid::Uuid {
    let chore = ChoreRepository::create(
        pool,
        CreateChoreParams {
            name,
            description: None,
            schedule_type: ScheduleType::Interval,
            cron_schedule: None,
            interval_days: Some(1),
            interval_time_hour: Some(9),
            interval_time_minute: Some(0),
        },
    )
    .await
    .expect("create chore");

    chore.id
}

async fn delivery_id_for_event(pool: &sqlx::SqlitePool, event_id: uuid::Uuid) -> uuid::Uuid {
    sqlx::query_scalar::<_, uuid::Uuid>(
        "SELECT id FROM notification_deliveries WHERE event_id = ? AND channel = ?",
    )
    .bind(event_id)
    .bind(NotificationChannel::Telegram)
    .fetch_one(pool)
    .await
    .expect("fetch delivery id")
}

#[tokio::test]
async fn test_upsert_due_event_deduplicates_events_and_deliveries() {
    let pool = db::create_pool("sqlite::memory:")
        .await
        .expect("create pool");
    let chore_id = create_chore(&pool, "Vacuum").await;
    let due_at = Utc::now();

    let first_id = NotificationRepository::upsert_due_event_with_deliveries(
        &pool,
        chore_id,
        due_at,
        "Chore due: Vacuum",
        "Vacuum is due",
        &[NotificationChannel::Telegram],
    )
    .await
    .expect("first upsert");

    let second_id = NotificationRepository::upsert_due_event_with_deliveries(
        &pool,
        chore_id,
        due_at,
        "Chore due: Vacuum",
        "Vacuum is due",
        &[NotificationChannel::Telegram],
    )
    .await
    .expect("second upsert");

    assert_eq!(first_id, second_id);

    let events_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM notification_events")
        .fetch_one(&pool)
        .await
        .expect("count events");
    let deliveries_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM notification_deliveries")
        .fetch_one(&pool)
        .await
        .expect("count deliveries");

    assert_eq!(events_count, 1);
    assert_eq!(deliveries_count, 1);
}

#[tokio::test]
async fn test_list_pending_filters_delivered_and_exhausted_failures() {
    let pool = db::create_pool("sqlite::memory:")
        .await
        .expect("create pool");

    let chore_a = create_chore(&pool, "A").await;
    let chore_b = create_chore(&pool, "B").await;
    let chore_c = create_chore(&pool, "C").await;
    let chore_d = create_chore(&pool, "D").await;

    let event_a = NotificationRepository::upsert_due_event_with_deliveries(
        &pool,
        chore_a,
        Utc::now(),
        "A due",
        "A",
        &[NotificationChannel::Telegram],
    )
    .await
    .expect("upsert event a");

    let event_b = NotificationRepository::upsert_due_event_with_deliveries(
        &pool,
        chore_b,
        Utc::now() + chrono::Duration::seconds(1),
        "B due",
        "B",
        &[NotificationChannel::Telegram],
    )
    .await
    .expect("upsert event b");

    let event_c = NotificationRepository::upsert_due_event_with_deliveries(
        &pool,
        chore_c,
        Utc::now() + chrono::Duration::seconds(2),
        "C due",
        "C",
        &[NotificationChannel::Telegram],
    )
    .await
    .expect("upsert event c");

    let event_d = NotificationRepository::upsert_due_event_with_deliveries(
        &pool,
        chore_d,
        Utc::now() + chrono::Duration::seconds(3),
        "D due",
        "D",
        &[NotificationChannel::Telegram],
    )
    .await
    .expect("upsert event d");

    let delivery_b = delivery_id_for_event(&pool, event_b).await;
    let delivery_c = delivery_id_for_event(&pool, event_c).await;
    let delivery_d = delivery_id_for_event(&pool, event_d).await;

    NotificationRepository::mark_failed(&pool, delivery_b, "temporary")
        .await
        .expect("fail b once");
    NotificationRepository::mark_delivered(&pool, delivery_c)
        .await
        .expect("deliver c");
    for _ in 0..5 {
        NotificationRepository::mark_failed(&pool, delivery_d, "retrying")
            .await
            .expect("fail d");
    }

    let pending = NotificationRepository::list_pending(&pool, 50, 5)
        .await
        .expect("list pending");

    let event_ids: Vec<uuid::Uuid> = pending.iter().map(|p| p.event_id).collect();
    assert!(event_ids.contains(&event_a));
    assert!(event_ids.contains(&event_b));
    assert!(!event_ids.contains(&event_c));
    assert!(!event_ids.contains(&event_d));
}

#[tokio::test]
async fn test_mark_failed_and_mark_delivered_transition_delivery_state() {
    let pool = db::create_pool("sqlite::memory:")
        .await
        .expect("create pool");
    let chore_id = create_chore(&pool, "Laundry").await;

    let event_id = NotificationRepository::upsert_due_event_with_deliveries(
        &pool,
        chore_id,
        Utc::now(),
        "Laundry due",
        "Laundry is due",
        &[NotificationChannel::Telegram],
    )
    .await
    .expect("upsert event");

    let delivery_id = delivery_id_for_event(&pool, event_id).await;

    NotificationRepository::mark_failed(&pool, delivery_id, "network timeout")
        .await
        .expect("mark failed");

    let failed_row: (String, i32, Option<String>, Option<String>) = sqlx::query_as(
        "SELECT status, attempt_count, last_error, delivered_at FROM notification_deliveries WHERE id = ?",
    )
    .bind(delivery_id)
    .fetch_one(&pool)
    .await
    .expect("fetch failed row");

    assert_eq!(failed_row.0, "failed");
    assert_eq!(failed_row.1, 1);
    assert!(failed_row.2.unwrap_or_default().contains("network timeout"));
    assert!(failed_row.3.is_none());

    NotificationRepository::mark_delivered(&pool, delivery_id)
        .await
        .expect("mark delivered");

    let delivered_row: (String, i32, Option<String>, Option<String>) = sqlx::query_as(
        "SELECT status, attempt_count, last_error, delivered_at FROM notification_deliveries WHERE id = ?",
    )
    .bind(delivery_id)
    .fetch_one(&pool)
    .await
    .expect("fetch delivered row");

    assert_eq!(delivered_row.0, "delivered");
    assert_eq!(delivered_row.1, 1);
    assert!(delivered_row.2.is_none());
    assert!(delivered_row.3.is_some());
}

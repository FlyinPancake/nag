use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;

use sqlx::SqlitePool;
use tokio::time::{self, Duration};

use crate::db::{
    NotificationRepository, models::NotificationChannel, notifications::PendingNotification,
};
use crate::services::ChoreService;

mod telegram;

pub use telegram::TelegramChannel;

#[derive(Debug, Clone)]
pub struct NotificationRuntimeConfig {
    pub poll_interval_seconds: u64,
    pub dispatch_interval_seconds: u64,
    pub max_attempts: i32,
    pub batch_size: i64,
}

impl Default for NotificationRuntimeConfig {
    fn default() -> Self {
        Self {
            poll_interval_seconds: 60,
            dispatch_interval_seconds: 15,
            max_attempts: 5,
            batch_size: 50,
        }
    }
}

pub trait NotificationChannelSender: Send + Sync {
    fn channel(&self) -> NotificationChannel;

    fn send<'a>(
        &'a self,
        notification: &'a PendingNotification,
    ) -> Pin<Box<dyn Future<Output = Result<(), String>> + Send + 'a>>;
}

pub async fn run_event_generator(
    pool: SqlitePool,
    channels: Vec<NotificationChannel>,
    config: NotificationRuntimeConfig,
) {
    let mut interval = time::interval(Duration::from_secs(config.poll_interval_seconds));
    interval.set_missed_tick_behavior(time::MissedTickBehavior::Skip);

    loop {
        interval.tick().await;
        generate_due_events_once(&pool, &channels).await;
    }
}

pub async fn run_dispatcher(
    pool: SqlitePool,
    senders: Vec<Arc<dyn NotificationChannelSender>>,
    config: NotificationRuntimeConfig,
) {
    let mut interval = time::interval(Duration::from_secs(config.dispatch_interval_seconds));
    interval.set_missed_tick_behavior(time::MissedTickBehavior::Skip);

    loop {
        interval.tick().await;
        dispatch_pending_once(&pool, &senders, config.batch_size, config.max_attempts).await;
    }
}

pub async fn generate_due_events_once(pool: &SqlitePool, channels: &[NotificationChannel]) {
    match ChoreService::get_due_chores(pool, false).await {
        Ok(due_chores) => {
            for item in due_chores {
                let Some(due_at) = item.next_due else {
                    continue;
                };

                let title = format!("Chore due: {}", item.chore.name);
                let body = format!(
                    "{} is due at {} UTC.",
                    item.chore.name,
                    due_at.format("%Y-%m-%d %H:%M")
                );

                if let Err(e) = NotificationRepository::upsert_due_event_with_deliveries(
                    pool,
                    item.chore.id,
                    due_at,
                    &title,
                    &body,
                    channels,
                )
                .await
                {
                    tracing::error!(error = %e, "Failed to upsert notification event");
                }
            }
        }
        Err(e) => {
            tracing::error!(error = %e, "Failed to collect due chores for notifications");
        }
    }
}

pub async fn dispatch_pending_once(
    pool: &SqlitePool,
    senders: &[Arc<dyn NotificationChannelSender>],
    batch_size: i64,
    max_attempts: i32,
) {
    let pending = match NotificationRepository::list_pending(pool, batch_size, max_attempts).await {
        Ok(items) => items,
        Err(e) => {
            tracing::error!(error = %e, "Failed to fetch pending notification deliveries");
            return;
        }
    };

    for delivery in pending {
        let sender = senders
            .iter()
            .find(|s| s.channel() == delivery.channel)
            .cloned();

        let Some(sender) = sender else {
            let error = format!("No sender configured for channel: {:?}", delivery.channel);
            if let Err(e) =
                NotificationRepository::mark_failed(pool, delivery.delivery_id, &error).await
            {
                tracing::error!(error = %e, "Failed to mark delivery as failed");
            }
            continue;
        };

        match sender.send(&delivery).await {
            Ok(()) => {
                if let Err(e) =
                    NotificationRepository::mark_delivered(pool, delivery.delivery_id).await
                {
                    tracing::error!(error = %e, "Failed to mark delivery as delivered");
                }
            }
            Err(error) => {
                if let Err(e) =
                    NotificationRepository::mark_failed(pool, delivery.delivery_id, &error).await
                {
                    tracing::error!(error = %e, "Failed to mark delivery as failed");
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use std::sync::Mutex;

    use chrono::Utc;

    use crate::db::{
        self, ChoreRepository, NotificationRepository, chores::CreateChoreParams,
        models::ScheduleType,
    };

    use super::*;

    struct FakeSender {
        channel: NotificationChannel,
        fail: bool,
        calls: Mutex<Vec<String>>,
    }

    impl FakeSender {
        fn new(channel: NotificationChannel, fail: bool) -> Self {
            Self {
                channel,
                fail,
                calls: Mutex::new(Vec::new()),
            }
        }
    }

    impl NotificationChannelSender for FakeSender {
        fn channel(&self) -> NotificationChannel {
            self.channel
        }

        fn send<'a>(
            &'a self,
            notification: &'a PendingNotification,
        ) -> Pin<Box<dyn Future<Output = Result<(), String>> + Send + 'a>> {
            Box::pin(async move {
                self.calls
                    .lock()
                    .expect("fake sender lock poisoned")
                    .push(format!("{}:{}", notification.title, notification.body));
                if self.fail {
                    Err("simulated send failure".to_string())
                } else {
                    Ok(())
                }
            })
        }
    }

    async fn seed_delivery(pool: &SqlitePool) -> uuid::Uuid {
        let chore = ChoreRepository::create(
            pool,
            CreateChoreParams {
                name: "Test chore",
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

        let event_id = NotificationRepository::upsert_due_event_with_deliveries(
            pool,
            chore.id,
            Utc::now(),
            "Chore due",
            "Test chore is due",
            &[NotificationChannel::Telegram],
        )
        .await
        .expect("upsert event");

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
    async fn test_dispatch_pending_once_marks_delivered_on_success() {
        let pool = db::create_pool("sqlite::memory:")
            .await
            .expect("create pool");
        let delivery_id = seed_delivery(&pool).await;

        let sender = Arc::new(FakeSender::new(NotificationChannel::Telegram, false));
        let senders: Vec<Arc<dyn NotificationChannelSender>> = vec![sender];

        dispatch_pending_once(&pool, &senders, 50, 5).await;

        let status: String =
            sqlx::query_scalar("SELECT status FROM notification_deliveries WHERE id = ?")
                .bind(delivery_id)
                .fetch_one(&pool)
                .await
                .expect("fetch status");
        assert_eq!(status, "delivered");
    }

    #[tokio::test]
    async fn test_dispatch_pending_once_marks_failed_when_sender_missing() {
        let pool = db::create_pool("sqlite::memory:")
            .await
            .expect("create pool");
        let delivery_id = seed_delivery(&pool).await;

        dispatch_pending_once(&pool, &[], 50, 5).await;

        let row: (String, i32, Option<String>) = sqlx::query_as(
            "SELECT status, attempt_count, last_error FROM notification_deliveries WHERE id = ?",
        )
        .bind(delivery_id)
        .fetch_one(&pool)
        .await
        .expect("fetch delivery row");

        assert_eq!(row.0, "failed");
        assert_eq!(row.1, 1);
        assert!(row.2.unwrap_or_default().contains("No sender configured"));
    }
}

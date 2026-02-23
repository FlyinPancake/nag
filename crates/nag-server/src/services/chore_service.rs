use chrono::{DateTime, Duration, NaiveTime, Utc};
use croner::Cron;
use sqlx::SqlitePool;

use crate::db::{
    ChoreRepository,
    models::{ChoreWithLastCompletion, ScheduleType},
};

/// Minimum interval for interval-based schedules (1 day)
pub const MIN_INTERVAL_DAYS: i32 = 1;

/// Maximum interval for interval-based schedules (1 year)
pub const MAX_INTERVAL_DAYS: i32 = 365;

/// A chore with computed due information
#[derive(Debug, Clone)]
pub struct ChoreWithDueInfo {
    pub chore: ChoreWithLastCompletion,
    pub next_due: Option<DateTime<Utc>>,
    pub is_overdue: bool,
}

pub struct ChoreService;

impl ChoreService {
    /// Get all chores that are due or overdue
    pub async fn get_due_chores(
        pool: &SqlitePool,
        include_upcoming: bool,
    ) -> color_eyre::Result<Vec<ChoreWithDueInfo>> {
        let chores = ChoreRepository::list_all_with_last_completion(pool).await?;
        let now = Utc::now();

        let mut result = Vec::new();

        for chore in chores {
            if let Some(due_info) = Self::compute_due_info(&chore, now) {
                // Include if overdue, or if include_upcoming is true
                if due_info.is_overdue || include_upcoming {
                    result.push(due_info);
                }
            }
        }

        // Sort by next_due (overdue first, then by soonest due)
        result.sort_by(|a, b| match (&a.next_due, &b.next_due) {
            (Some(a_due), Some(b_due)) => a_due.cmp(b_due),
            (Some(_), None) => std::cmp::Ordering::Less,
            (None, Some(_)) => std::cmp::Ordering::Greater,
            (None, None) => std::cmp::Ordering::Equal,
        });

        Ok(result)
    }

    /// Compute the next due time for a single chore
    pub fn compute_due_info(
        chore: &ChoreWithLastCompletion,
        now: DateTime<Utc>,
    ) -> Option<ChoreWithDueInfo> {
        match chore.schedule_type {
            ScheduleType::Cron => Self::compute_cron_due(chore, now),
            ScheduleType::Interval => Self::compute_interval_due(chore, now),
            ScheduleType::OnceInAWhile => Some(ChoreWithDueInfo {
                chore: chore.clone(),
                next_due: None,
                is_overdue: false,
            }),
        }
    }

    /// Compute due info for a cron-based chore
    fn compute_cron_due(
        chore: &ChoreWithLastCompletion,
        now: DateTime<Utc>,
    ) -> Option<ChoreWithDueInfo> {
        let cron_schedule = chore.cron_schedule.as_ref()?;

        let cron = match Cron::new(cron_schedule).parse() {
            Ok(c) => c,
            Err(e) => {
                tracing::warn!(
                    chore_id = %chore.id,
                    schedule = %cron_schedule,
                    error = %e,
                    "Failed to parse cron schedule"
                );
                return None;
            }
        };

        // Base time is either last completion or chore creation
        let base_time = chore.last_completed_at.unwrap_or(chore.created_at);

        // Find the next occurrence after base_time
        let next_due = cron.find_next_occurrence(&base_time, false).ok()?;
        let is_overdue = next_due <= now;

        Some(ChoreWithDueInfo {
            chore: chore.clone(),
            next_due: Some(next_due),
            is_overdue,
        })
    }

    /// Compute due info for an interval-based chore
    fn compute_interval_due(
        chore: &ChoreWithLastCompletion,
        now: DateTime<Utc>,
    ) -> Option<ChoreWithDueInfo> {
        let interval_days = chore.interval_days?;

        // Base time is either last completion or chore creation
        let base_time = chore.last_completed_at.unwrap_or(chore.created_at);

        // Calculate the due date by adding interval days
        let due_date = base_time.date_naive() + Duration::days(i64::from(interval_days));

        // Apply configured time of day (default to midnight UTC)
        let hour = chore.interval_time_hour.unwrap_or(0) as u32;
        let minute = chore.interval_time_minute.unwrap_or(0) as u32;

        let time = NaiveTime::from_hms_opt(hour, minute, 0)?;
        let next_due = due_date.and_time(time).and_utc();

        let is_overdue = next_due <= now;

        Some(ChoreWithDueInfo {
            chore: chore.clone(),
            next_due: Some(next_due),
            is_overdue,
        })
    }

    /// Validate a cron schedule string.
    ///
    /// Returns an error if:
    /// - The schedule is not valid cron syntax
    /// - The schedule would fire more frequently than once per hour
    pub fn validate_cron_schedule(schedule: &str) -> Result<(), String> {
        let cron = Cron::new(schedule).parse().map_err(|e| e.to_string())?;

        // Check frequency by finding two consecutive occurrences
        let now = Utc::now();
        let first = cron
            .find_next_occurrence(&now, false)
            .map_err(|e| e.to_string())?;
        let second = cron
            .find_next_occurrence(&first, false)
            .map_err(|e| e.to_string())?;

        let interval = second - first;
        if interval < Duration::hours(1) {
            return Err("Schedule is too frequent. Minimum interval is 1 hour.".to_string());
        }

        Ok(())
    }

    /// Validate an interval schedule.
    ///
    /// Returns an error if:
    /// - The interval is less than 1 day
    /// - The interval is greater than 365 days (1 year)
    /// - The time values are out of range
    pub fn validate_interval_schedule(
        days: i32,
        hour: Option<i32>,
        minute: Option<i32>,
    ) -> Result<(), String> {
        if days < MIN_INTERVAL_DAYS {
            return Err(format!(
                "Interval must be at least {} day(s)",
                MIN_INTERVAL_DAYS
            ));
        }
        if days > MAX_INTERVAL_DAYS {
            return Err(format!(
                "Interval cannot exceed {} days (1 year)",
                MAX_INTERVAL_DAYS
            ));
        }

        if let Some(h) = hour
            && !(0..=23).contains(&h)
        {
            return Err("Hour must be between 0 and 23".to_string());
        }

        if let Some(m) = minute
            && !(0..=59).contains(&m)
        {
            return Err("Minute must be between 0 and 59".to_string());
        }

        Ok(())
    }
}

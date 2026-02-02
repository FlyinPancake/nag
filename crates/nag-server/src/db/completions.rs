use chrono::{DateTime, Utc};
use sqlx::SqlitePool;
use uuid::Uuid;

use super::models::Completion;

const DEFAULT_PAGE_SIZE: i64 = 20;

pub struct CompletionRepository;

impl CompletionRepository {
    /// List completions for a chore with cursor-based pagination
    pub async fn list_for_chore(
        pool: &SqlitePool,
        chore_id: Uuid,
        cursor: Option<Uuid>,
        limit: Option<i64>,
    ) -> sqlx::Result<Vec<Completion>> {
        let limit = limit.unwrap_or(DEFAULT_PAGE_SIZE);

        match cursor {
            Some(cursor_id) => {
                sqlx::query_as::<_, Completion>(
                    r#"
                    SELECT id, chore_id, completed_at, notes, created_at
                    FROM completions
                    WHERE chore_id = ? AND id > ?
                    ORDER BY completed_at DESC, id
                    LIMIT ?
                    "#,
                )
                .bind(chore_id)
                .bind(cursor_id)
                .bind(limit)
                .fetch_all(pool)
                .await
            }
            None => {
                sqlx::query_as::<_, Completion>(
                    r#"
                    SELECT id, chore_id, completed_at, notes, created_at
                    FROM completions
                    WHERE chore_id = ?
                    ORDER BY completed_at DESC, id
                    LIMIT ?
                    "#,
                )
                .bind(chore_id)
                .bind(limit)
                .fetch_all(pool)
                .await
            }
        }
    }

    /// Create a new completion record
    pub async fn create(
        pool: &SqlitePool,
        chore_id: Uuid,
        completed_at: Option<DateTime<Utc>>,
        notes: Option<&str>,
    ) -> sqlx::Result<Completion> {
        let id = Uuid::new_v4();
        let now = Utc::now();
        let completed_at = completed_at.unwrap_or(now);

        sqlx::query(
            r#"
            INSERT INTO completions (id, chore_id, completed_at, notes, created_at)
            VALUES (?, ?, ?, ?, ?)
            "#,
        )
        .bind(id)
        .bind(chore_id)
        .bind(completed_at)
        .bind(notes)
        .bind(now)
        .execute(pool)
        .await?;

        Ok(Completion {
            id,
            chore_id,
            completed_at,
            notes: notes.map(String::from),
            created_at: now,
        })
    }

    /// Delete a completion by ID
    pub async fn delete(pool: &SqlitePool, id: Uuid) -> sqlx::Result<bool> {
        let result = sqlx::query("DELETE FROM completions WHERE id = ?")
            .bind(id)
            .execute(pool)
            .await?;

        Ok(result.rows_affected() > 0)
    }

    /// Check if a chore exists
    pub async fn chore_exists(pool: &SqlitePool, chore_id: Uuid) -> sqlx::Result<bool> {
        let result = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM chores WHERE id = ?")
            .bind(chore_id)
            .fetch_one(pool)
            .await?;

        Ok(result > 0)
    }
}

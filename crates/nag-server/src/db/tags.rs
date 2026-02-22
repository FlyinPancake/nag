use std::collections::HashMap;

use chrono::Utc;
use sqlx::SqlitePool;
use uuid::Uuid;

use super::models::Tag;

pub struct TagRepository;

impl TagRepository {
    /// List all tags ordered by name
    pub async fn list(pool: &SqlitePool) -> sqlx::Result<Vec<Tag>> {
        sqlx::query_as::<_, Tag>(
            r#"
            SELECT id, name, color, created_at
            FROM tags
            ORDER BY name
            "#,
        )
        .fetch_all(pool)
        .await
    }

    /// Find a tag by exact name (case-insensitive)
    pub async fn find_by_name(pool: &SqlitePool, name: &str) -> sqlx::Result<Option<Tag>> {
        sqlx::query_as::<_, Tag>(
            r#"
            SELECT id, name, color, created_at
            FROM tags
            WHERE LOWER(name) = LOWER(?)
            "#,
        )
        .bind(name)
        .fetch_optional(pool)
        .await
    }

    /// Create a new tag
    pub async fn create(pool: &SqlitePool, name: &str, color: Option<&str>) -> sqlx::Result<Tag> {
        let id = Uuid::new_v4();
        let now = Utc::now();

        sqlx::query(
            r#"
            INSERT INTO tags (id, name, color, created_at)
            VALUES (?, ?, ?, ?)
            "#,
        )
        .bind(id)
        .bind(name)
        .bind(color)
        .bind(now)
        .execute(pool)
        .await?;

        Ok(Tag {
            id,
            name: name.to_string(),
            color: color.map(|c| c.to_string()),
            created_at: now,
        })
    }

    /// Update a tag (color and/or name)
    pub async fn update(
        pool: &SqlitePool,
        id: Uuid,
        name: Option<&str>,
        color: Option<Option<&str>>,
    ) -> sqlx::Result<Option<Tag>> {
        // Build SET clauses dynamically
        let mut sets = Vec::new();
        if name.is_some() {
            sets.push("name = ?");
        }
        if color.is_some() {
            sets.push("color = ?");
        }

        if sets.is_empty() {
            // Nothing to update, just fetch current
            return sqlx::query_as::<_, Tag>(
                "SELECT id, name, color, created_at FROM tags WHERE id = ?",
            )
            .bind(id)
            .fetch_optional(pool)
            .await;
        }

        let query_str = format!(
            "UPDATE tags SET {} WHERE id = ? RETURNING id, name, color, created_at",
            sets.join(", ")
        );

        let mut query = sqlx::query_as::<_, Tag>(&query_str);

        if let Some(n) = name {
            query = query.bind(n);
        }
        if let Some(c) = color {
            query = query.bind(c);
        }

        query = query.bind(id);

        query.fetch_optional(pool).await
    }

    /// Delete a tag by ID
    pub async fn delete(pool: &SqlitePool, id: Uuid) -> sqlx::Result<bool> {
        let result = sqlx::query("DELETE FROM tags WHERE id = ?")
            .bind(id)
            .execute(pool)
            .await?;

        Ok(result.rows_affected() > 0)
    }

    /// Get all tags for a specific chore
    pub async fn get_tags_for_chore(pool: &SqlitePool, chore_id: Uuid) -> sqlx::Result<Vec<Tag>> {
        sqlx::query_as::<_, Tag>(
            r#"
            SELECT t.id, t.name, t.color, t.created_at
            FROM tags t
            INNER JOIN chore_tags ct ON ct.tag_id = t.id
            WHERE ct.chore_id = ?
            ORDER BY t.name
            "#,
        )
        .bind(chore_id)
        .fetch_all(pool)
        .await
    }

    /// Batch-load tags for multiple chores at once
    pub async fn get_tags_for_chores(
        pool: &SqlitePool,
        chore_ids: &[Uuid],
    ) -> sqlx::Result<HashMap<Uuid, Vec<Tag>>> {
        if chore_ids.is_empty() {
            return Ok(HashMap::new());
        }

        // SQLite doesn't support array binds, so we build placeholders
        let placeholders: Vec<&str> = chore_ids.iter().map(|_| "?").collect();
        let query = format!(
            r#"
            SELECT ct.chore_id, t.id, t.name, t.color, t.created_at
            FROM tags t
            INNER JOIN chore_tags ct ON ct.tag_id = t.id
            WHERE ct.chore_id IN ({})
            ORDER BY t.name
            "#,
            placeholders.join(", ")
        );

        let mut query_builder = sqlx::query_as::<_, ChoreTagRow>(&query);
        for id in chore_ids {
            query_builder = query_builder.bind(id);
        }

        let rows = query_builder.fetch_all(pool).await?;

        let mut map: HashMap<Uuid, Vec<Tag>> = HashMap::new();
        for row in rows {
            map.entry(row.chore_id).or_default().push(Tag {
                id: row.id,
                name: row.name,
                color: row.color,
                created_at: row.created_at,
            });
        }

        Ok(map)
    }

    /// Find existing tags or create new ones by name.
    /// Returns all tags matching the given names (case-insensitive matching for existing tags).
    pub async fn find_or_create_tags(
        pool: &SqlitePool,
        names: &[String],
    ) -> sqlx::Result<Vec<Tag>> {
        let mut tags = Vec::with_capacity(names.len());

        for name in names {
            let trimmed = name.trim();
            if trimmed.is_empty() {
                continue;
            }

            match Self::find_by_name(pool, trimmed).await? {
                Some(existing) => tags.push(existing),
                None => {
                    let new_tag = Self::create(pool, trimmed, None).await?;
                    tags.push(new_tag);
                }
            }
        }

        Ok(tags)
    }

    /// Set the tags for a chore, replacing any existing tag assignments.
    /// Creates new tags as needed (on-the-fly). Returns the final set of tags.
    pub async fn set_chore_tags(
        pool: &SqlitePool,
        chore_id: Uuid,
        tag_names: &[String],
    ) -> sqlx::Result<Vec<Tag>> {
        // Remove all existing tag associations for this chore
        sqlx::query("DELETE FROM chore_tags WHERE chore_id = ?")
            .bind(chore_id)
            .execute(pool)
            .await?;

        if tag_names.is_empty() {
            return Ok(Vec::new());
        }

        // Find or create all tags
        let tags = Self::find_or_create_tags(pool, tag_names).await?;

        // Insert junction rows
        for tag in &tags {
            sqlx::query(
                r#"
                INSERT OR IGNORE INTO chore_tags (chore_id, tag_id)
                VALUES (?, ?)
                "#,
            )
            .bind(chore_id)
            .bind(tag.id)
            .execute(pool)
            .await?;
        }

        Ok(tags)
    }
}

/// Helper struct for the batch query that includes chore_id
#[derive(Debug, sqlx::FromRow)]
struct ChoreTagRow {
    chore_id: Uuid,
    id: Uuid,
    name: String,
    color: Option<String>,
    created_at: chrono::DateTime<chrono::Utc>,
}

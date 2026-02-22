use sqlx::SqlitePool;
use uuid::Uuid;

use super::models::User;

pub struct UserRepository;

impl UserRepository {
    /// Find or create a user by their OIDC issuer + subject.
    ///
    /// If the user already exists, update their email and name.
    /// Returns the user record.
    pub async fn upsert(
        pool: &SqlitePool,
        oidc_issuer: &str,
        oidc_subject: &str,
        email: Option<&str>,
        name: Option<&str>,
        picture: Option<&str>,
    ) -> Result<User, sqlx::Error> {
        let id = Uuid::new_v4();
        let now = chrono::Utc::now();

        // INSERT or UPDATE on conflict (oidc_issuer, oidc_subject)
        sqlx::query_as::<_, User>(
            r#"
            INSERT INTO users (id, oidc_issuer, oidc_subject, email, name, picture, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (oidc_issuer, oidc_subject) DO UPDATE SET
                email = excluded.email,
                name = excluded.name,
                picture = excluded.picture,
                updated_at = excluded.updated_at
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(oidc_issuer)
        .bind(oidc_subject)
        .bind(email)
        .bind(name)
        .bind(picture)
        .bind(now)
        .bind(now)
        .fetch_one(pool)
        .await
    }

    /// Find a user by their database ID.
    pub async fn find_by_id(pool: &SqlitePool, id: Uuid) -> Result<Option<User>, sqlx::Error> {
        sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = ?")
            .bind(id)
            .fetch_optional(pool)
            .await
    }
}

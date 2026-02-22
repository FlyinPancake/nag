pub mod chores;
pub mod completions;
pub mod models;
pub mod notifications;
pub mod tags;
pub mod users;

use sqlx::{SqlitePool, sqlite::SqlitePoolOptions};

pub use chores::ChoreRepository;
pub use completions::CompletionRepository;
pub use notifications::NotificationRepository;
pub use tags::TagRepository;
pub use users::UserRepository;

pub async fn create_pool(database_url: &str) -> color_eyre::Result<SqlitePool> {
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(database_url)
        .await?;

    // Run embedded migrations
    sqlx::migrate!().run(&pool).await?;

    Ok(pool)
}

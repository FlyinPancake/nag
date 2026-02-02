pub mod chores;
pub mod completions;
pub mod models;

use sqlx::{SqlitePool, sqlite::SqlitePoolOptions};

pub use chores::ChoreRepository;
pub use completions::CompletionRepository;

pub async fn create_pool(database_url: &str) -> color_eyre::Result<SqlitePool> {
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(database_url)
        .await?;

    // Run embedded migrations
    sqlx::migrate!().run(&pool).await?;

    Ok(pool)
}

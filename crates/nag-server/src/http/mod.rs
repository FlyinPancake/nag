mod middleware;
pub mod models;
mod routes;
mod static_files;

use axum::Router;
use sqlx::SqlitePool;

/// Build the complete application with routes and middleware
pub fn build_app(pool: SqlitePool) -> Router {
    let router = routes::app_router(pool).fallback(static_files::static_handler);
    middleware::apply_middleware(router)
}

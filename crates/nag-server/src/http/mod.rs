mod middleware;
pub mod models;
pub mod routes;
mod static_files;

use std::sync::Arc;

use axum::Router;
use sqlx::SqlitePool;
use tower_sessions::SessionStore;

use crate::services::OidcService;

/// Shared application state
#[derive(Clone)]
pub struct AppState {
    pub pool: SqlitePool,
    /// `None` when `AUTH_ENABLED=false` — API routes are unprotected.
    pub oidc: Option<Arc<OidcService>>,
}

/// Build the complete application with routes and middleware.
///
/// When `session_store` is `Some`, full session management is applied (for
/// OIDC auth). When `None`, a lightweight no-op session layer is used so that
/// the `Session` extractor never panics (even though no auth routes exist).
pub fn build_app(state: AppState, session_store: Option<impl SessionStore + Clone>) -> Router {
    let router = routes::app_router(state.clone()).fallback(static_files::static_handler);
    middleware::apply_middleware(router, session_store)
}

/// Build the app without OIDC (for integration tests).
///
/// This skips the OIDC client setup and session-based auth.
/// All API routes are accessible without authentication.
pub fn build_test_app(pool: SqlitePool) -> Router {
    let state = AppState { pool, oidc: None };
    let router = routes::test_app_router(state).fallback(static_files::static_handler);
    middleware::apply_test_middleware(router)
}

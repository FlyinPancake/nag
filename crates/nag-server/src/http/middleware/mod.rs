use axum::Router;
use time::Duration;
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tower_sessions::{Expiry, MemoryStore, SessionManagerLayer, SessionStore};

/// Apply middleware layers to the router.
///
/// When `session_store` is `Some`, the provided store is used for session
/// management (OIDC auth flow). When `None`, a lightweight in-memory store
/// is used so the `Session` extractor never panics.
pub fn apply_middleware(
    router: Router,
    session_store: Option<impl SessionStore + Clone>,
) -> Router {
    let common = |r: Router| {
        r.layer(TraceLayer::new_for_http())
            .layer(CorsLayer::permissive())
    };

    match session_store {
        Some(store) => {
            let session_layer = SessionManagerLayer::new(store)
                .with_secure(false)
                .with_same_site(tower_sessions::cookie::SameSite::Lax)
                .with_expiry(Expiry::OnInactivity(Duration::days(1)));
            common(router.layer(session_layer))
        }
        None => {
            let session_layer = SessionManagerLayer::new(MemoryStore::default())
                .with_secure(false)
                .with_expiry(Expiry::OnInactivity(Duration::days(1)));
            common(router.layer(session_layer))
        }
    }
}

/// Apply middleware for test mode (in-memory sessions, no auth enforced).
pub fn apply_test_middleware(router: Router) -> Router {
    let session_store = MemoryStore::default();
    let session_layer = SessionManagerLayer::new(session_store)
        .with_secure(false)
        .with_expiry(Expiry::OnInactivity(Duration::days(1)));

    router
        .layer(session_layer)
        .layer(TraceLayer::new_for_http())
        .layer(CorsLayer::permissive())
}

use axum::Router;
use tower_http::{cors::CorsLayer, trace::TraceLayer};

/// Apply middleware layers to the router
pub fn apply_middleware(router: Router) -> Router {
    router
        .layer(TraceLayer::new_for_http())
        .layer(CorsLayer::permissive())
}

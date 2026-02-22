use axum::{
    Extension, Json, Router, middleware as axum_middleware, response::IntoResponse, routing::get,
};
use serde::Serialize;
use utoipa::{OpenApi, ToSchema};
use utoipa_axum::{router::OpenApiRouter, routes};

use super::AppState;
use super::models::{
    ChoreResponse, ChoreWithDueResponse, CompleteChoreRequest, CompletionResponse,
    CreateChoreRequest, CreateTagRequest, DueChoresQuery, ListChoresQuery, ListCompletionsQuery,
    PaginatedResponse, ProblemDetailsSchema, TagResponse, UpdateChoreRequest, UpdateTagRequest,
};

mod api;
pub mod auth;
mod scalar;

/// Base OpenAPI spec with shared schemas
#[derive(OpenApi)]
#[openapi(
    components(schemas(
        HealthResponse,
        AppConfigResponse,
        ProblemDetailsSchema,
        // Chore schemas
        ChoreResponse,
        ChoreWithDueResponse,
        CompletionResponse,
        CreateChoreRequest,
        UpdateChoreRequest,
        CompleteChoreRequest,
        ListChoresQuery,
        ListCompletionsQuery,
        DueChoresQuery,
        PaginatedResponse<ChoreResponse>,
        PaginatedResponse<CompletionResponse>,
        // Tag schemas
        TagResponse,
        CreateTagRequest,
        UpdateTagRequest,
    )),
    info(title = "Nag API", description = "Nag server API")
)]
struct ApiDoc;

/// Health check response
#[derive(Debug, Serialize, ToSchema)]
pub struct HealthResponse {
    /// Service status
    pub status: &'static str,
}

/// Health check endpoint
#[utoipa::path(get, path = "/health", responses((status = 200, body = HealthResponse)))]
pub async fn health() -> Json<HealthResponse> {
    Json(HealthResponse { status: "ok" })
}

/// Application configuration exposed to the frontend
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct AppConfigResponse {
    /// Whether OIDC authentication is enabled
    pub auth_enabled: bool,
}

/// Create the application router.
///
/// When `state.oidc` is `Some`, OIDC auth routes are registered and `/api/*`
/// routes are protected by the session-based auth guard.
/// When `state.oidc` is `None`, all API routes are publicly accessible.
pub fn app_router(state: AppState) -> Router {
    let pool = state.pool.clone();
    let auth_enabled = state.oidc.is_some();

    // Build the OpenAPI schema from the combined router (for docs generation only)
    let (_combined_router, openapi) = OpenApiRouter::with_openapi(ApiDoc::openapi())
        .routes(routes!(health))
        .nest("/api", api::router())
        .split_for_parts();

    let api_routes: Router = api::router().into();

    let mut router = Router::new().route("/health", get(health));

    if auth_enabled {
        // Auth routes (require AppState for OIDC client, but no auth guard)
        let auth_routes = Router::new()
            .route("/login", get(auth::login))
            .route("/callback", get(auth::callback))
            .route("/logout", get(auth::logout))
            .route("/me", get(auth::me))
            .with_state(state.clone());

        // Protected /api/* routes with auth guard
        let protected_api = Router::new()
            .nest("/api", api_routes)
            .layer(axum_middleware::from_fn(auth_guard));

        router = router.merge(protected_api).nest("/auth", auth_routes);
    } else {
        // No auth guard — API routes are publicly accessible
        router = router.nest("/api", api_routes);
    }

    // Public config endpoint (always available, outside auth guard)
    let config_response = AppConfigResponse { auth_enabled };
    router = router.route(
        "/api/config",
        get(move || {
            let resp = config_response.clone();
            async move { Json(resp) }
        }),
    );

    let openapi_clone = openapi.clone();
    router
        .route(
            "/docs/schema.json",
            get(move || async move { Json(openapi_clone) }),
        )
        .nest("/docs", scalar::router())
        .layer(Extension(pool))
}

/// Create the application router without auth (for integration tests).
pub fn test_app_router(state: AppState) -> Router {
    let pool = state.pool.clone();

    let (router, openapi) = OpenApiRouter::with_openapi(ApiDoc::openapi())
        .routes(routes!(health))
        .nest("/api", api::router())
        .split_for_parts();

    // Public config endpoint
    let config_response = AppConfigResponse {
        auth_enabled: false,
    };

    router
        .route(
            "/api/config",
            get(move || {
                let resp = config_response.clone();
                async move { Json(resp) }
            }),
        )
        .route(
            "/docs/schema.json",
            get(move || async move { Json(openapi.clone()) }),
        )
        .nest("/docs", scalar::router())
        .layer(Extension(pool))
}

/// Middleware function that checks for an authenticated session on protected routes.
async fn auth_guard(
    session: tower_sessions::Session,
    request: axum::extract::Request,
    next: axum::middleware::Next,
) -> axum::response::Response {
    match auth::require_auth(&session).await {
        Ok(_user_id) => next.run(request).await,
        Err(e) => e.into_response(),
    }
}

use axum::{Extension, Json, Router, routing::get};
use serde::Serialize;
use sqlx::SqlitePool;
use utoipa::{OpenApi, ToSchema};
use utoipa_axum::{router::OpenApiRouter, routes};

use super::models::{
    ChoreResponse, ChoreWithDueResponse, CompleteChoreRequest, CompletionResponse,
    CreateChoreRequest, DueChoresQuery, ListChoresQuery, ListCompletionsQuery, PaginatedResponse,
    ProblemDetailsSchema, UpdateChoreRequest,
};

mod api;
mod scalar;

/// Base OpenAPI spec with shared schemas
#[derive(OpenApi)]
#[openapi(
    components(schemas(
        HealthResponse,
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

/// Create the application router with all routes
pub fn app_router(pool: SqlitePool) -> Router {
    let (router, openapi) = OpenApiRouter::with_openapi(ApiDoc::openapi())
        .routes(routes!(health))
        .nest("/api", api::router())
        .split_for_parts();

    // Add pool as extension and schema endpoint
    router
        .route(
            "/docs/schema.json",
            get(move || async move { Json(openapi.clone()) }),
        )
        .nest("/docs", scalar::router())
        .layer(Extension(pool))
}

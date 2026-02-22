//! Test utilities and helpers for API integration tests.
//!
//! Note: Many test helpers and response structures may appear unused in individual
//! test modules due to how Rust compiles each test independently. They are shared
//! across multiple test files (api_chores, api_completions, api_health).

#![allow(dead_code)]

use axum::http::StatusCode;
use axum_test::TestServer;
use nag_server::{db, http};
use serde::Deserialize;

/// Create a test server with an in-memory SQLite database.
///
/// Each call creates a fresh database with migrations applied,
/// providing test isolation. Uses `build_test_app` which skips
/// OIDC authentication, making all API routes accessible without auth.
pub async fn create_test_app() -> TestServer {
    let pool = db::create_pool("sqlite::memory:")
        .await
        .expect("Failed to create test database pool");

    let app = http::build_test_app(pool);

    TestServer::new(app.into_make_service()).expect("Failed to create test server")
}

/// Response structure for tags (matches TagResponse from the API).
#[derive(Debug, Deserialize)]
pub struct TagResponse {
    pub id: uuid::Uuid,
    pub name: String,
    pub color: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

/// Response structure for chores (matches ChoreResponse from the API).
#[derive(Debug, Deserialize)]
pub struct ChoreResponse {
    pub id: uuid::Uuid,
    pub name: String,
    pub description: Option<String>,
    pub schedule_type: String,
    pub cron_schedule: Option<String>,
    pub interval_days: Option<i32>,
    pub interval_time_hour: Option<i32>,
    pub interval_time_minute: Option<i32>,
    pub last_completed_at: Option<chrono::DateTime<chrono::Utc>>,
    pub tags: Vec<TagResponse>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

/// Response structure for chores with due info.
#[derive(Debug, Deserialize)]
pub struct ChoreWithDueResponse {
    pub id: uuid::Uuid,
    pub name: String,
    pub description: Option<String>,
    pub schedule_type: String,
    pub cron_schedule: Option<String>,
    pub interval_days: Option<i32>,
    pub interval_time_hour: Option<i32>,
    pub interval_time_minute: Option<i32>,
    pub last_completed_at: Option<chrono::DateTime<chrono::Utc>>,
    pub next_due: Option<chrono::DateTime<chrono::Utc>>,
    pub is_overdue: bool,
    pub tags: Vec<TagResponse>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

/// Response structure for completions (matches CompletionResponse from the API).
#[derive(Debug, Deserialize)]
pub struct CompletionResponse {
    pub id: uuid::Uuid,
    pub chore_id: uuid::Uuid,
    pub completed_at: chrono::DateTime<chrono::Utc>,
    pub notes: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

/// Paginated response wrapper.
#[derive(Debug, Deserialize)]
pub struct PaginatedResponse<T> {
    pub items: Vec<T>,
    pub next_cursor: Option<uuid::Uuid>,
}

/// RFC 7807 Problem Details response.
#[derive(Debug, Deserialize)]
pub struct ProblemDetails {
    #[serde(rename = "type")]
    pub problem_type: Option<String>,
    pub title: Option<String>,
    pub status: Option<u16>,
    pub detail: Option<String>,
}

/// Helper to create a cron-based chore via the API.
///
/// Returns the created chore response for use in subsequent tests.
pub async fn create_chore(server: &TestServer, name: &str, cron_schedule: &str) -> ChoreResponse {
    create_cron_chore_with_description(server, name, None, cron_schedule).await
}

/// Helper to create a cron-based chore with optional description.
pub async fn create_cron_chore_with_description(
    server: &TestServer,
    name: &str,
    description: Option<&str>,
    cron_schedule: &str,
) -> ChoreResponse {
    let body = serde_json::json!({
        "name": name,
        "description": description,
        "schedule_type": "cron",
        "cron_schedule": cron_schedule
    });

    let response = server.post("/api/chores").json(&body).await;
    response.assert_status(StatusCode::CREATED);
    response.json()
}

/// Helper to create an interval-based chore.
pub async fn create_interval_chore(
    server: &TestServer,
    name: &str,
    interval_days: i32,
) -> ChoreResponse {
    create_interval_chore_with_time(server, name, None, interval_days, None, None).await
}

/// Helper to create an interval-based chore with optional description and time.
#[allow(dead_code)]
pub async fn create_interval_chore_with_time(
    server: &TestServer,
    name: &str,
    description: Option<&str>,
    interval_days: i32,
    interval_time_hour: Option<i32>,
    interval_time_minute: Option<i32>,
) -> ChoreResponse {
    let body = serde_json::json!({
        "name": name,
        "description": description,
        "schedule_type": "interval",
        "interval_days": interval_days,
        "interval_time_hour": interval_time_hour,
        "interval_time_minute": interval_time_minute
    });

    let response = server.post("/api/chores").json(&body).await;
    response.assert_status(StatusCode::CREATED);
    response.json()
}

/// Helper to complete a chore via the API.
pub async fn complete_chore(
    server: &TestServer,
    chore_id: uuid::Uuid,
    notes: Option<&str>,
) -> CompletionResponse {
    let body = serde_json::json!({
        "notes": notes
    });

    let response = server
        .post(&format!("/api/chores/{}/complete", chore_id))
        .json(&body)
        .await;
    response.assert_status(StatusCode::CREATED);
    response.json()
}

/// Helper to create a tag via the API.
pub async fn create_tag(server: &TestServer, name: &str) -> TagResponse {
    let body = serde_json::json!({ "name": name });
    let response = server.post("/api/tags").json(&body).await;
    response.assert_status(StatusCode::CREATED);
    response.json()
}

/// Helper to create a chore with tags via the API.
pub async fn create_chore_with_tags(
    server: &TestServer,
    name: &str,
    cron_schedule: &str,
    tags: &[&str],
) -> ChoreResponse {
    let body = serde_json::json!({
        "name": name,
        "schedule_type": "cron",
        "cron_schedule": cron_schedule,
        "tags": tags
    });

    let response = server.post("/api/chores").json(&body).await;
    response.assert_status(StatusCode::CREATED);
    response.json()
}

/// Helper to create a tag with a specific color via the API.
pub async fn create_tag_with_color(
    server: &TestServer,
    name: &str,
    color: Option<&str>,
) -> TagResponse {
    let body = serde_json::json!({ "name": name, "color": color });
    let response = server.post("/api/tags").json(&body).await;
    response.assert_status(StatusCode::CREATED);
    response.json()
}

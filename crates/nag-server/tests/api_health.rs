//! Health check endpoint tests.

mod common;

use serde::Deserialize;

#[derive(Debug, Deserialize)]
struct HealthResponse {
    status: String,
}

#[tokio::test]
async fn test_health_check_returns_ok() {
    let server = common::create_test_app().await;

    let response = server.get("/health").await;

    response.assert_status_ok();

    let body: HealthResponse = response.json();
    assert_eq!(body.status, "ok");
}

#[tokio::test]
async fn test_health_check_content_type_is_json() {
    let server = common::create_test_app().await;

    let response = server.get("/health").await;

    response.assert_status_ok();
    assert!(
        response
            .headers()
            .get("content-type")
            .unwrap()
            .to_str()
            .unwrap()
            .contains("application/json")
    );
}

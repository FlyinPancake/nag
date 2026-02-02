//! Completion API endpoint tests.
//!
//! Tests cover:
//! - Delete completion (DELETE /api/completions/{id})
//!
//! Note: Other completion operations (create, list) are tested in api_chores.rs
//! as they are accessed through the chore resource.

mod common;

use axum::http::StatusCode;
use common::ProblemDetails;
use uuid::Uuid;

// ============================================================================
// Delete Completion (DELETE /api/completions/{id})
// ============================================================================

#[tokio::test]
async fn test_delete_completion_success() {
    let server = common::create_test_app().await;

    // Create a chore and complete it
    let chore = common::create_chore(&server, "Vacuum", "0 9 * * 1").await;
    let completion = common::complete_chore(&server, chore.id, Some("Done")).await;

    // Delete the completion
    let response = server
        .delete(&format!("/api/completions/{}", completion.id))
        .await;

    response.assert_status(StatusCode::NO_CONTENT);

    // Verify it's actually deleted by checking the chore's completions
    let list_response = server
        .get(&format!("/api/chores/{}/completions", chore.id))
        .await;
    let completions: common::PaginatedResponse<common::CompletionResponse> = list_response.json();
    assert!(completions.items.is_empty());
}

#[tokio::test]
async fn test_delete_completion_not_found() {
    let server = common::create_test_app().await;

    let fake_id = Uuid::new_v4();
    let response = server
        .delete(&format!("/api/completions/{}", fake_id))
        .await;

    response.assert_status(StatusCode::NOT_FOUND);

    let problem: ProblemDetails = response.json();
    assert_eq!(problem.status, Some(404));
    assert!(problem.detail.unwrap().contains("not found"));
    assert!(problem.title.is_some());
}

#[tokio::test]
async fn test_delete_completion_invalid_uuid() {
    let server = common::create_test_app().await;

    let response = server.delete("/api/completions/not-a-uuid").await;

    // Axum returns 400 for path parsing failures
    response.assert_status(StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn test_delete_one_completion_leaves_others() {
    let server = common::create_test_app().await;

    // Create a chore and add multiple completions
    let chore = common::create_chore(&server, "Vacuum", "0 9 * * 1").await;
    let completion1 = common::complete_chore(&server, chore.id, Some("First")).await;
    let completion2 = common::complete_chore(&server, chore.id, Some("Second")).await;
    let completion3 = common::complete_chore(&server, chore.id, Some("Third")).await;

    // Delete the middle one
    let response = server
        .delete(&format!("/api/completions/{}", completion2.id))
        .await;
    response.assert_status(StatusCode::NO_CONTENT);

    // Check remaining completions
    let list_response = server
        .get(&format!("/api/chores/{}/completions", chore.id))
        .await;
    let completions: common::PaginatedResponse<common::CompletionResponse> = list_response.json();

    assert_eq!(completions.items.len(), 2);

    let remaining_ids: Vec<_> = completions.items.iter().map(|c| c.id).collect();
    assert!(remaining_ids.contains(&completion1.id));
    assert!(!remaining_ids.contains(&completion2.id));
    assert!(remaining_ids.contains(&completion3.id));
}

#[tokio::test]
async fn test_delete_completion_does_not_affect_chore() {
    let server = common::create_test_app().await;

    // Create a chore and complete it
    let chore = common::create_chore(&server, "Vacuum", "0 9 * * 1").await;
    let completion = common::complete_chore(&server, chore.id, Some("Done")).await;

    // Delete the completion
    let response = server
        .delete(&format!("/api/completions/{}", completion.id))
        .await;
    response.assert_status(StatusCode::NO_CONTENT);

    // The chore should still exist
    let chore_response = server.get(&format!("/api/chores/{}", chore.id)).await;
    chore_response.assert_status_ok();

    let fetched_chore: common::ChoreResponse = chore_response.json();
    assert_eq!(fetched_chore.id, chore.id);
    assert_eq!(fetched_chore.name, "Vacuum");
}

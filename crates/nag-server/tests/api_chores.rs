//! Chore API endpoint tests.
//!
//! Tests cover:
//! - CRUD operations (create, read, update, delete)
//! - Pagination
//! - Due chores endpoint
//! - Error cases (404, 400)

mod common;

use axum::http::StatusCode;
use common::{ChoreResponse, ChoreWithDueResponse, PaginatedResponse, ProblemDetails};
use uuid::Uuid;

// ============================================================================
// List Chores (GET /api/chores)
// ============================================================================

#[tokio::test]
async fn test_list_chores_empty() {
    let server = common::create_test_app().await;

    let response = server.get("/api/chores").await;

    response.assert_status_ok();

    let body: PaginatedResponse<ChoreResponse> = response.json();
    assert!(body.items.is_empty());
    assert!(body.next_cursor.is_none());
}

#[tokio::test]
async fn test_list_chores_with_items() {
    let server = common::create_test_app().await;

    // Create some chores
    common::create_chore(&server, "Vacuum", "0 9 * * 1").await;
    common::create_chore(&server, "Dishes", "0 20 * * *").await;

    let response = server.get("/api/chores").await;

    response.assert_status_ok();

    let body: PaginatedResponse<ChoreResponse> = response.json();
    assert_eq!(body.items.len(), 2);
}

#[tokio::test]
async fn test_list_chores_pagination_limit() {
    let server = common::create_test_app().await;

    // Create 5 chores
    for i in 1..=5 {
        common::create_chore(&server, &format!("Chore {}", i), "0 9 * * *").await;
    }

    // Request with limit of 2
    let response = server.get("/api/chores?limit=2").await;

    response.assert_status_ok();

    let body: PaginatedResponse<ChoreResponse> = response.json();
    assert_eq!(body.items.len(), 2);
    assert!(body.next_cursor.is_some());
}

#[tokio::test]
async fn test_list_chores_pagination_cursor() {
    let server = common::create_test_app().await;

    // Create 5 chores
    for i in 1..=5 {
        common::create_chore(&server, &format!("Chore {}", i), "0 9 * * *").await;
    }

    // Get first page
    let response = server.get("/api/chores?limit=2").await;
    let first_page: PaginatedResponse<ChoreResponse> = response.json();
    assert_eq!(first_page.items.len(), 2);

    // Get second page using cursor
    let cursor = first_page.next_cursor.unwrap();
    let response = server
        .get(&format!("/api/chores?limit=2&cursor={}", cursor))
        .await;
    let second_page: PaginatedResponse<ChoreResponse> = response.json();
    assert_eq!(second_page.items.len(), 2);

    // Verify no overlap
    let first_ids: Vec<_> = first_page.items.iter().map(|c| c.id).collect();
    let second_ids: Vec<_> = second_page.items.iter().map(|c| c.id).collect();
    for id in &second_ids {
        assert!(!first_ids.contains(id));
    }
}

// ============================================================================
// Create Chore (POST /api/chores)
// ============================================================================

#[tokio::test]
async fn test_create_chore_success() {
    let server = common::create_test_app().await;

    let body = serde_json::json!({
        "name": "Vacuum the living room",
        "description": "Use the Dyson",
        "schedule_type": "cron",
        "cron_schedule": "0 9 * * 1"
    });

    let response = server.post("/api/chores").json(&body).await;

    response.assert_status(StatusCode::CREATED);

    let chore: ChoreResponse = response.json();
    assert_eq!(chore.name, "Vacuum the living room");
    assert_eq!(chore.description, Some("Use the Dyson".to_string()));
    assert_eq!(chore.schedule_type, "cron");
    assert_eq!(chore.cron_schedule, Some("0 9 * * 1".to_string()));
    assert!(chore.interval_days.is_none());
    assert!(chore.interval_time_hour.is_none());
    assert!(chore.interval_time_minute.is_none());
    assert!(chore.last_completed_at.is_none());
    // Verify timestamps are present and reasonable
    assert!(chore.created_at <= chrono::Utc::now());
    assert!(chore.updated_at <= chrono::Utc::now());
    assert_eq!(chore.created_at, chore.updated_at); // Should be equal on creation
}

#[tokio::test]
async fn test_create_chore_without_description() {
    let server = common::create_test_app().await;

    let body = serde_json::json!({
        "name": "Vacuum",
        "schedule_type": "cron",
        "cron_schedule": "0 9 * * 1"
    });

    let response = server.post("/api/chores").json(&body).await;

    response.assert_status(StatusCode::CREATED);

    let chore: ChoreResponse = response.json();
    assert_eq!(chore.name, "Vacuum");
    assert!(chore.description.is_none());
}

#[tokio::test]
async fn test_create_chore_invalid_cron_schedule() {
    let server = common::create_test_app().await;

    let body = serde_json::json!({
        "name": "Vacuum",
        "schedule_type": "cron",
        "cron_schedule": "not a valid cron"
    });

    let response = server.post("/api/chores").json(&body).await;

    response.assert_status(StatusCode::BAD_REQUEST);

    let problem: ProblemDetails = response.json();
    assert_eq!(problem.status, Some(400));
    assert!(problem.detail.unwrap().contains("Invalid cron schedule"));
    assert!(problem.title.is_some());
    assert!(problem.problem_type.is_some());
}

#[tokio::test]
async fn test_create_chore_too_frequent_schedule() {
    let server = common::create_test_app().await;

    // Every minute is too frequent (minimum is hourly)
    let body = serde_json::json!({
        "name": "Too frequent",
        "schedule_type": "cron",
        "cron_schedule": "* * * * *"
    });

    let response = server.post("/api/chores").json(&body).await;

    response.assert_status(StatusCode::BAD_REQUEST);

    let problem: ProblemDetails = response.json();
    assert_eq!(problem.status, Some(400));
    assert!(problem.detail.unwrap().contains("too frequent"));
    assert!(problem.title.is_some());
}

#[tokio::test]
async fn test_create_interval_chore_success() {
    let server = common::create_test_app().await;

    let body = serde_json::json!({
        "name": "Water the cactus",
        "description": "Don't overwater!",
        "schedule_type": "interval",
        "interval_days": 30
    });

    let response = server.post("/api/chores").json(&body).await;

    response.assert_status(StatusCode::CREATED);

    let chore: ChoreResponse = response.json();
    assert_eq!(chore.name, "Water the cactus");
    assert_eq!(chore.description, Some("Don't overwater!".to_string()));
    assert_eq!(chore.schedule_type, "interval");
    assert_eq!(chore.interval_days, Some(30));
    assert!(chore.interval_time_hour.is_none());
    assert!(chore.interval_time_minute.is_none());
    assert!(chore.cron_schedule.is_none());
    // Verify timestamps
    assert!(chore.created_at <= chrono::Utc::now());
    assert!(chore.updated_at <= chrono::Utc::now());
}

#[tokio::test]
async fn test_create_interval_chore_with_time() {
    let server = common::create_test_app().await;

    let body = serde_json::json!({
        "name": "Water plants",
        "schedule_type": "interval",
        "interval_days": 7,
        "interval_time_hour": 9,
        "interval_time_minute": 30
    });

    let response = server.post("/api/chores").json(&body).await;

    response.assert_status(StatusCode::CREATED);

    let chore: ChoreResponse = response.json();
    assert_eq!(chore.schedule_type, "interval");
    assert_eq!(chore.interval_days, Some(7));
    assert_eq!(chore.interval_time_hour, Some(9));
    assert_eq!(chore.interval_time_minute, Some(30));
}

#[tokio::test]
async fn test_create_interval_chore_invalid_days() {
    let server = common::create_test_app().await;

    // Interval too long (max is 365 days)
    let body = serde_json::json!({
        "name": "Too infrequent",
        "schedule_type": "interval",
        "interval_days": 500
    });

    let response = server.post("/api/chores").json(&body).await;

    response.assert_status(StatusCode::BAD_REQUEST);

    let problem: ProblemDetails = response.json();
    assert_eq!(problem.status, Some(400));
    assert!(problem.detail.unwrap().contains("365"));
}

#[tokio::test]
async fn test_create_interval_chore_zero_days() {
    let server = common::create_test_app().await;

    // Interval must be at least 1 day
    let body = serde_json::json!({
        "name": "Too frequent",
        "schedule_type": "interval",
        "interval_days": 0
    });

    let response = server.post("/api/chores").json(&body).await;

    response.assert_status(StatusCode::BAD_REQUEST);

    let problem: ProblemDetails = response.json();
    assert_eq!(problem.status, Some(400));
    assert!(problem.detail.unwrap().contains("at least"));
}

#[tokio::test]
async fn test_create_chore_missing_required_fields() {
    let server = common::create_test_app().await;

    // Missing name
    let body = serde_json::json!({
        "cron_schedule": "0 9 * * 1"
    });

    let response = server.post("/api/chores").json(&body).await;

    // Should fail with 422 (Unprocessable Entity) from serde deserialization
    response.assert_status(StatusCode::UNPROCESSABLE_ENTITY);
}

// ============================================================================
// Get Chore (GET /api/chores/{id})
// ============================================================================

#[tokio::test]
async fn test_get_chore_success() {
    let server = common::create_test_app().await;

    let created = common::create_chore(&server, "Vacuum", "0 9 * * 1").await;

    let response = server.get(&format!("/api/chores/{}", created.id)).await;

    response.assert_status_ok();

    let chore: ChoreResponse = response.json();
    assert_eq!(chore.id, created.id);
    assert_eq!(chore.name, "Vacuum");
}

#[tokio::test]
async fn test_get_chore_not_found() {
    let server = common::create_test_app().await;

    let fake_id = Uuid::new_v4();
    let response = server.get(&format!("/api/chores/{}", fake_id)).await;

    response.assert_status(StatusCode::NOT_FOUND);

    let problem: ProblemDetails = response.json();
    assert_eq!(problem.status, Some(404));
    assert!(problem.detail.unwrap().contains("not found"));
    assert!(problem.title.is_some());
}

#[tokio::test]
async fn test_get_chore_invalid_uuid() {
    let server = common::create_test_app().await;

    let response = server.get("/api/chores/not-a-uuid").await;

    // Axum returns 400 for path parsing failures
    response.assert_status(StatusCode::BAD_REQUEST);
}

// ============================================================================
// Update Chore (PUT /api/chores/{id})
// ============================================================================

#[tokio::test]
async fn test_update_chore_all_fields() {
    let server = common::create_test_app().await;

    let created = common::create_chore(&server, "Vacuum", "0 9 * * 1").await;

    let body = serde_json::json!({
        "name": "Vacuum Thoroughly",
        "description": "Including under furniture",
        "schedule": {
            "schedule_type": "cron",
            "cron_schedule": "0 10 * * 0"
        }
    });

    let response = server
        .put(&format!("/api/chores/{}", created.id))
        .json(&body)
        .await;

    response.assert_status_ok();

    let chore: ChoreResponse = response.json();
    assert_eq!(chore.name, "Vacuum Thoroughly");
    assert_eq!(
        chore.description,
        Some("Including under furniture".to_string())
    );
    assert_eq!(chore.cron_schedule, Some("0 10 * * 0".to_string()));
}

#[tokio::test]
async fn test_update_chore_partial() {
    let server = common::create_test_app().await;

    let created = common::create_cron_chore_with_description(
        &server,
        "Vacuum",
        Some("Original"),
        "0 9 * * 1",
    )
    .await;

    // Only update name
    let body = serde_json::json!({
        "name": "Vacuum Thoroughly"
    });

    let response = server
        .put(&format!("/api/chores/{}", created.id))
        .json(&body)
        .await;

    response.assert_status_ok();

    let chore: ChoreResponse = response.json();
    assert_eq!(chore.name, "Vacuum Thoroughly");
    // Other fields should be unchanged
    assert_eq!(chore.description, Some("Original".to_string()));
    assert_eq!(chore.cron_schedule, Some("0 9 * * 1".to_string()));
}

#[tokio::test]
async fn test_update_chore_clear_description() {
    let server = common::create_test_app().await;

    let created = common::create_cron_chore_with_description(
        &server,
        "Vacuum",
        Some("Original"),
        "0 9 * * 1",
    )
    .await;

    // Set description to null to clear it
    let body = serde_json::json!({
        "description": null
    });

    let response = server
        .put(&format!("/api/chores/{}", created.id))
        .json(&body)
        .await;

    response.assert_status_ok();

    let chore: ChoreResponse = response.json();
    assert!(chore.description.is_none());
}

#[tokio::test]
async fn test_update_chore_not_found() {
    let server = common::create_test_app().await;

    let fake_id = Uuid::new_v4();
    let body = serde_json::json!({
        "name": "Updated"
    });

    let response = server
        .put(&format!("/api/chores/{}", fake_id))
        .json(&body)
        .await;

    response.assert_status(StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_update_chore_invalid_cron() {
    let server = common::create_test_app().await;

    let created = common::create_chore(&server, "Vacuum", "0 9 * * 1").await;

    let body = serde_json::json!({
        "schedule": {
            "schedule_type": "cron",
            "cron_schedule": "invalid cron"
        }
    });

    let response = server
        .put(&format!("/api/chores/{}", created.id))
        .json(&body)
        .await;

    response.assert_status(StatusCode::BAD_REQUEST);

    let problem: ProblemDetails = response.json();
    assert!(problem.detail.unwrap().contains("Invalid cron schedule"));
    assert!(problem.title.is_some());
}

#[tokio::test]
async fn test_update_chore_change_to_interval() {
    let server = common::create_test_app().await;

    // Create a cron-based chore
    let created = common::create_chore(&server, "Vacuum", "0 9 * * 1").await;
    assert_eq!(created.schedule_type, "cron");

    // Update to interval-based
    let body = serde_json::json!({
        "schedule": {
            "schedule_type": "interval",
            "interval_days": 14,
            "interval_time_hour": 10
        }
    });

    let response = server
        .put(&format!("/api/chores/{}", created.id))
        .json(&body)
        .await;

    response.assert_status_ok();

    let chore: ChoreResponse = response.json();
    assert_eq!(chore.schedule_type, "interval");
    assert_eq!(chore.interval_days, Some(14));
    assert_eq!(chore.interval_time_hour, Some(10));
    assert!(chore.cron_schedule.is_none());
}

#[tokio::test]
async fn test_update_chore_updates_timestamp() {
    let server = common::create_test_app().await;

    let created = common::create_chore(&server, "Vacuum", "0 9 * * 1").await;
    let original_updated_at = created.updated_at;

    // Small delay to ensure timestamp will be different
    tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;

    // Update the chore
    let body = serde_json::json!({
        "name": "Vacuum Thoroughly"
    });

    let response = server
        .put(&format!("/api/chores/{}", created.id))
        .json(&body)
        .await;

    response.assert_status_ok();

    let updated: ChoreResponse = response.json();
    assert_eq!(updated.name, "Vacuum Thoroughly");

    // updated_at should have changed
    assert!(updated.updated_at > original_updated_at);
    // created_at should remain the same
    assert_eq!(updated.created_at, created.created_at);
}

// ============================================================================
// Delete Chore (DELETE /api/chores/{id})
// ============================================================================

#[tokio::test]
async fn test_delete_chore_success() {
    let server = common::create_test_app().await;

    let created = common::create_chore(&server, "Vacuum", "0 9 * * 1").await;

    let response = server.delete(&format!("/api/chores/{}", created.id)).await;

    response.assert_status(StatusCode::NO_CONTENT);

    // Verify it's actually deleted
    let get_response = server.get(&format!("/api/chores/{}", created.id)).await;
    get_response.assert_status(StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_delete_chore_not_found() {
    let server = common::create_test_app().await;

    let fake_id = Uuid::new_v4();
    let response = server.delete(&format!("/api/chores/{}", fake_id)).await;

    response.assert_status(StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_delete_chore_also_deletes_completions() {
    let server = common::create_test_app().await;

    let created = common::create_chore(&server, "Vacuum", "0 9 * * 1").await;

    // Add some completions
    common::complete_chore(&server, created.id, Some("Done")).await;
    common::complete_chore(&server, created.id, None).await;

    // Delete the chore
    let response = server.delete(&format!("/api/chores/{}", created.id)).await;
    response.assert_status(StatusCode::NO_CONTENT);

    // Completions should be gone too (foreign key cascade)
    // We can verify by trying to get the chore's completions - should 404
    let completions_response = server
        .get(&format!("/api/chores/{}/completions", created.id))
        .await;
    completions_response.assert_status(StatusCode::NOT_FOUND);
}

// ============================================================================
// Due Chores (GET /api/chores/due)
// ============================================================================

#[tokio::test]
async fn test_due_chores_empty() {
    let server = common::create_test_app().await;

    let response = server.get("/api/chores/due").await;

    response.assert_status_ok();

    let chores: Vec<ChoreWithDueResponse> = response.json();
    assert!(chores.is_empty());
}

#[tokio::test]
async fn test_due_chores_with_overdue() {
    let server = common::create_test_app().await;

    // Create a daily chore and complete it in the past to make it overdue
    let chore = common::create_chore(&server, "Daily task", "0 9 * * *").await;

    // Complete it with a timestamp from a week ago - this makes the chore overdue
    // because the next daily occurrence would be in the past
    let body = serde_json::json!({
        "completed_at": "2020-01-01T00:00:00Z"
    });
    server
        .post(&format!("/api/chores/{}/complete", chore.id))
        .json(&body)
        .await
        .assert_status(StatusCode::CREATED);

    let response = server.get("/api/chores/due").await;

    response.assert_status_ok();

    let chores: Vec<ChoreWithDueResponse> = response.json();
    // Should have at least one overdue chore (since it was completed years ago
    // and should have been due many times since)
    assert!(!chores.is_empty());

    // Verify the overdue chore has proper fields
    let overdue_chore = chores.iter().find(|c| c.is_overdue).unwrap();
    assert!(overdue_chore.is_overdue);
    assert!(overdue_chore.next_due.is_some());
    assert_eq!(overdue_chore.schedule_type, "cron");
    assert!(overdue_chore.last_completed_at.is_some());
}

#[tokio::test]
async fn test_due_chores_include_upcoming() {
    let server = common::create_test_app().await;

    // Create a weekly chore - likely not overdue but will be upcoming
    common::create_chore(&server, "Weekly task", "0 9 * * 0").await;

    // Without include_upcoming
    let response = server.get("/api/chores/due").await;
    let without_upcoming: Vec<ChoreWithDueResponse> = response.json();

    // With include_upcoming
    let response = server.get("/api/chores/due?include_upcoming=true").await;
    let with_upcoming: Vec<ChoreWithDueResponse> = response.json();

    // With upcoming should have at least as many (likely more) than without
    assert!(with_upcoming.len() >= without_upcoming.len());
}

#[tokio::test]
async fn test_due_chores_response_includes_due_info() {
    let server = common::create_test_app().await;

    // Create an hourly chore (minimum allowed frequency)
    common::create_chore(&server, "Hourly task", "0 * * * *").await;

    let response = server.get("/api/chores/due?include_upcoming=true").await;

    response.assert_status_ok();

    let chores: Vec<ChoreWithDueResponse> = response.json();
    assert!(!chores.is_empty());

    let chore = &chores[0];
    // Verify all fields are populated correctly
    assert_eq!(chore.name, "Hourly task");
    assert_eq!(chore.schedule_type, "cron");
    assert_eq!(chore.cron_schedule, Some("0 * * * *".to_string()));
    // next_due should be set
    assert!(chore.next_due.is_some());
    // Timestamps should be present
    assert!(chore.created_at <= chrono::Utc::now());
    assert!(chore.updated_at <= chrono::Utc::now());
}

// ============================================================================
// Complete Chore (POST /api/chores/{id}/complete)
// ============================================================================

#[tokio::test]
async fn test_complete_chore_success() {
    let server = common::create_test_app().await;

    let created = common::create_chore(&server, "Vacuum", "0 9 * * 1").await;

    let body = serde_json::json!({});

    let response = server
        .post(&format!("/api/chores/{}/complete", created.id))
        .json(&body)
        .await;

    response.assert_status(StatusCode::CREATED);

    let completion: common::CompletionResponse = response.json();
    assert_eq!(completion.chore_id, created.id);
    assert!(completion.notes.is_none());
    assert!(completion.completed_at <= chrono::Utc::now());
    assert!(completion.created_at <= chrono::Utc::now());
}

#[tokio::test]
async fn test_complete_chore_with_notes() {
    let server = common::create_test_app().await;

    let created = common::create_chore(&server, "Vacuum", "0 9 * * 1").await;

    let body = serde_json::json!({
        "notes": "Used the new vacuum"
    });

    let response = server
        .post(&format!("/api/chores/{}/complete", created.id))
        .json(&body)
        .await;

    response.assert_status(StatusCode::CREATED);

    let completion: common::CompletionResponse = response.json();
    assert_eq!(completion.chore_id, created.id);
    assert_eq!(completion.notes, Some("Used the new vacuum".to_string()));
    // Verify timestamps
    assert!(completion.completed_at <= chrono::Utc::now());
    assert!(completion.created_at <= chrono::Utc::now());
}

#[tokio::test]
async fn test_complete_chore_with_custom_timestamp() {
    let server = common::create_test_app().await;

    let created = common::create_chore(&server, "Vacuum", "0 9 * * 1").await;

    let custom_time = "2024-01-15T10:30:00Z";
    let body = serde_json::json!({
        "completed_at": custom_time
    });

    let response = server
        .post(&format!("/api/chores/{}/complete", created.id))
        .json(&body)
        .await;

    response.assert_status(StatusCode::CREATED);

    let completion: common::CompletionResponse = response.json();
    assert_eq!(completion.chore_id, created.id);
    assert_eq!(
        completion.completed_at.to_rfc3339(),
        "2024-01-15T10:30:00+00:00"
    );
    // Verify created_at is also present
    assert!(completion.created_at <= chrono::Utc::now());
}

#[tokio::test]
async fn test_complete_chore_not_found() {
    let server = common::create_test_app().await;

    let fake_id = Uuid::new_v4();
    let body = serde_json::json!({});

    let response = server
        .post(&format!("/api/chores/{}/complete", fake_id))
        .json(&body)
        .await;

    response.assert_status(StatusCode::NOT_FOUND);
}

// ============================================================================
// List Completions (GET /api/chores/{id}/completions)
// ============================================================================

#[tokio::test]
async fn test_interval_chore_due_after_completion() {
    let server = common::create_test_app().await;

    // Create an interval chore using the helper
    let chore = common::create_interval_chore(&server, "Water plants", 7).await;
    assert_eq!(chore.schedule_type, "interval");
    assert_eq!(chore.interval_days, Some(7));

    // Complete it now
    common::complete_chore(&server, chore.id, None).await;

    // Check due chores - should not be due immediately after completion
    let response = server.get("/api/chores/due").await;
    let due_chores: Vec<ChoreWithDueResponse> = response.json();

    // Should not be overdue since just completed
    let our_chore = due_chores.iter().find(|c| c.id == chore.id);
    if let Some(our_chore) = our_chore {
        assert!(!our_chore.is_overdue);
        assert!(our_chore.next_due.is_some());
    }
}

// ============================================================================
// List Completions (GET /api/chores/{id}/completions)
// ============================================================================

#[tokio::test]
async fn test_list_completions_empty() {
    let server = common::create_test_app().await;

    let created = common::create_chore(&server, "Vacuum", "0 9 * * 1").await;

    let response = server
        .get(&format!("/api/chores/{}/completions", created.id))
        .await;

    response.assert_status_ok();

    let body: PaginatedResponse<common::CompletionResponse> = response.json();
    assert!(body.items.is_empty());
    assert!(body.next_cursor.is_none());
}

#[tokio::test]
async fn test_list_completions_with_items() {
    let server = common::create_test_app().await;

    let created = common::create_chore(&server, "Vacuum", "0 9 * * 1").await;

    // Add some completions
    common::complete_chore(&server, created.id, Some("First")).await;
    common::complete_chore(&server, created.id, Some("Second")).await;

    let response = server
        .get(&format!("/api/chores/{}/completions", created.id))
        .await;

    response.assert_status_ok();

    let body: PaginatedResponse<common::CompletionResponse> = response.json();
    assert_eq!(body.items.len(), 2);
}

#[tokio::test]
async fn test_list_completions_pagination() {
    let server = common::create_test_app().await;

    let created = common::create_chore(&server, "Vacuum", "0 9 * * 1").await;

    // Add 5 completions
    for _ in 0..5 {
        common::complete_chore(&server, created.id, None).await;
    }

    // Get first page with limit
    let response = server
        .get(&format!("/api/chores/{}/completions?limit=2", created.id))
        .await;

    let body: PaginatedResponse<common::CompletionResponse> = response.json();
    assert_eq!(body.items.len(), 2);
    assert!(body.next_cursor.is_some());
}

#[tokio::test]
async fn test_list_completions_chore_not_found() {
    let server = common::create_test_app().await;

    let fake_id = Uuid::new_v4();
    let response = server
        .get(&format!("/api/chores/{}/completions", fake_id))
        .await;

    response.assert_status(StatusCode::NOT_FOUND);
}

// ============================================================================
// Once In A While Schedule
// ============================================================================

#[tokio::test]
async fn test_create_once_in_a_while_chore() {
    let server = common::create_test_app().await;

    let chore =
        common::create_once_in_a_while_chore(&server, "Clean the attic", Some("When needed")).await;

    assert_eq!(chore.name, "Clean the attic");
    assert_eq!(chore.description.as_deref(), Some("When needed"));
    assert_eq!(chore.schedule_type, "once_in_a_while");
    assert!(chore.cron_schedule.is_none());
    assert!(chore.interval_days.is_none());
    assert!(chore.interval_time_hour.is_none());
    assert!(chore.interval_time_minute.is_none());
}

#[tokio::test]
async fn test_once_in_a_while_chore_appears_in_list() {
    let server = common::create_test_app().await;

    let chore = common::create_once_in_a_while_chore(&server, "Organize garage", None).await;

    let response = server.get("/api/chores").await;
    response.assert_status_ok();

    let body: PaginatedResponse<ChoreResponse> = response.json();
    assert_eq!(body.items.len(), 1);
    assert_eq!(body.items[0].id, chore.id);
    assert_eq!(body.items[0].schedule_type, "once_in_a_while");
}

#[tokio::test]
async fn test_once_in_a_while_chore_in_due_endpoint() {
    let server = common::create_test_app().await;

    common::create_once_in_a_while_chore(&server, "Clean gutters", None).await;

    // With include_upcoming=true, once_in_a_while chores should appear
    let response = server.get("/api/chores/due?include_upcoming=true").await;
    response.assert_status_ok();

    let body: Vec<ChoreWithDueResponse> = response.json();
    assert_eq!(body.len(), 1);
    assert_eq!(body[0].schedule_type, "once_in_a_while");
    assert!(body[0].next_due.is_none());
    assert!(!body[0].is_overdue);
}

#[tokio::test]
async fn test_once_in_a_while_chore_not_overdue() {
    let server = common::create_test_app().await;

    common::create_once_in_a_while_chore(&server, "Deep clean fridge", None).await;

    // Without include_upcoming, once_in_a_while chores should NOT appear
    // (they are not overdue)
    let response = server.get("/api/chores/due?include_upcoming=false").await;
    response.assert_status_ok();

    let body: Vec<ChoreWithDueResponse> = response.json();
    assert!(body.is_empty());
}

#[tokio::test]
async fn test_once_in_a_while_chore_can_be_completed() {
    let server = common::create_test_app().await;

    let chore = common::create_once_in_a_while_chore(&server, "Sort photo albums", None).await;

    let completion = common::complete_chore(&server, chore.id, Some("Finally done!")).await;
    assert_eq!(completion.chore_id, chore.id);
    assert_eq!(completion.notes.as_deref(), Some("Finally done!"));

    // Verify last_completed_at is set
    let response = server.get(&format!("/api/chores/{}", chore.id)).await;
    response.assert_status_ok();
    let updated: ChoreResponse = response.json();
    assert!(updated.last_completed_at.is_some());
}

#[tokio::test]
async fn test_update_chore_to_once_in_a_while() {
    let server = common::create_test_app().await;

    // Create a normal interval chore
    let chore = common::create_interval_chore(&server, "Mow the lawn", 14).await;
    assert_eq!(chore.schedule_type, "interval");

    // Switch to once_in_a_while
    let response = server
        .put(&format!("/api/chores/{}", chore.id))
        .json(&serde_json::json!({
            "schedule": {
                "schedule_type": "once_in_a_while"
            }
        }))
        .await;
    response.assert_status_ok();

    let updated: ChoreResponse = response.json();
    assert_eq!(updated.schedule_type, "once_in_a_while");
    assert!(updated.cron_schedule.is_none());
    assert!(updated.interval_days.is_none());
}

#[tokio::test]
async fn test_update_once_in_a_while_to_interval() {
    let server = common::create_test_app().await;

    let chore = common::create_once_in_a_while_chore(&server, "Paint fence", None).await;

    // Switch to interval
    let response = server
        .put(&format!("/api/chores/{}", chore.id))
        .json(&serde_json::json!({
            "schedule": {
                "schedule_type": "interval",
                "interval_days": 90
            }
        }))
        .await;
    response.assert_status_ok();

    let updated: ChoreResponse = response.json();
    assert_eq!(updated.schedule_type, "interval");
    assert_eq!(updated.interval_days, Some(90));
}

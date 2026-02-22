//! Tag API endpoint tests.
//!
//! Tests cover:
//! - Tag CRUD (create, list, delete)
//! - Tag assignment via chore create/update
//! - Tag filtering on list/due endpoints
//! - Conflict on duplicate tag names
//! - Cascade behavior (deleting tag removes from chores, deleting chore doesn't delete tag)

mod common;

use axum::http::StatusCode;
use common::{ChoreResponse, ChoreWithDueResponse, PaginatedResponse, ProblemDetails, TagResponse};
use uuid::Uuid;

// ============================================================================
// Tag CRUD (GET/POST/DELETE /api/tags)
// ============================================================================

#[tokio::test]
async fn test_list_tags_empty() {
    let server = common::create_test_app().await;

    let response = server.get("/api/tags").await;
    response.assert_status_ok();

    let tags: Vec<TagResponse> = response.json();
    assert!(tags.is_empty());
}

#[tokio::test]
async fn test_create_tag() {
    let server = common::create_test_app().await;

    let tag = common::create_tag(&server, "kitchen").await;

    assert_eq!(tag.name, "kitchen");
    assert!(!tag.id.is_nil());
}

#[tokio::test]
async fn test_list_tags_with_items() {
    let server = common::create_test_app().await;

    common::create_tag(&server, "kitchen").await;
    common::create_tag(&server, "bathroom").await;
    common::create_tag(&server, "outdoor").await;

    let response = server.get("/api/tags").await;
    response.assert_status_ok();

    let tags: Vec<TagResponse> = response.json();
    assert_eq!(tags.len(), 3);

    // Should be sorted by name
    assert_eq!(tags[0].name, "bathroom");
    assert_eq!(tags[1].name, "kitchen");
    assert_eq!(tags[2].name, "outdoor");
}

#[tokio::test]
async fn test_create_tag_duplicate_name_returns_409() {
    let server = common::create_test_app().await;

    common::create_tag(&server, "kitchen").await;

    let body = serde_json::json!({ "name": "kitchen" });
    let response = server.post("/api/tags").json(&body).await;
    response.assert_status(StatusCode::CONFLICT);

    let problem: ProblemDetails = response.json();
    assert_eq!(problem.status, Some(409));
    assert!(problem.detail.unwrap().contains("already exists"));
}

#[tokio::test]
async fn test_create_tag_case_insensitive_duplicate_returns_409() {
    let server = common::create_test_app().await;

    common::create_tag(&server, "Kitchen").await;

    let body = serde_json::json!({ "name": "kitchen" });
    let response = server.post("/api/tags").json(&body).await;
    response.assert_status(StatusCode::CONFLICT);
}

#[tokio::test]
async fn test_create_tag_empty_name_returns_400() {
    let server = common::create_test_app().await;

    let body = serde_json::json!({ "name": "" });
    let response = server.post("/api/tags").json(&body).await;
    response.assert_status(StatusCode::BAD_REQUEST);

    let problem: ProblemDetails = response.json();
    assert!(problem.detail.unwrap().contains("empty"));
}

#[tokio::test]
async fn test_create_tag_too_long_name_returns_400() {
    let server = common::create_test_app().await;

    let long_name = "a".repeat(51);
    let body = serde_json::json!({ "name": long_name });
    let response = server.post("/api/tags").json(&body).await;
    response.assert_status(StatusCode::BAD_REQUEST);

    let problem: ProblemDetails = response.json();
    assert!(problem.detail.unwrap().contains("50 characters"));
}

#[tokio::test]
async fn test_delete_tag() {
    let server = common::create_test_app().await;

    let tag = common::create_tag(&server, "kitchen").await;

    let response = server.delete(&format!("/api/tags/{}", tag.id)).await;
    response.assert_status(StatusCode::NO_CONTENT);

    // Verify deleted
    let list_response = server.get("/api/tags").await;
    let tags: Vec<TagResponse> = list_response.json();
    assert!(tags.is_empty());
}

#[tokio::test]
async fn test_delete_tag_not_found() {
    let server = common::create_test_app().await;

    let fake_id = Uuid::new_v4();
    let response = server.delete(&format!("/api/tags/{}", fake_id)).await;
    response.assert_status(StatusCode::NOT_FOUND);
}

// ============================================================================
// Tags on Chore Create/Update
// ============================================================================

#[tokio::test]
async fn test_create_chore_with_tags() {
    let server = common::create_test_app().await;

    let chore =
        common::create_chore_with_tags(&server, "Vacuum", "0 9 * * 1", &["kitchen", "weekly"])
            .await;

    assert_eq!(chore.tags.len(), 2);
    let tag_names: Vec<&str> = chore.tags.iter().map(|t| t.name.as_str()).collect();
    assert!(tag_names.contains(&"kitchen"));
    assert!(tag_names.contains(&"weekly"));
}

#[tokio::test]
async fn test_create_chore_with_tags_creates_tags_on_the_fly() {
    let server = common::create_test_app().await;

    // No tags exist yet
    let tags: Vec<TagResponse> = server.get("/api/tags").await.json();
    assert!(tags.is_empty());

    // Creating a chore with tag names auto-creates the tags
    common::create_chore_with_tags(&server, "Vacuum", "0 9 * * 1", &["kitchen"]).await;

    let tags: Vec<TagResponse> = server.get("/api/tags").await.json();
    assert_eq!(tags.len(), 1);
    assert_eq!(tags[0].name, "kitchen");
}

#[tokio::test]
async fn test_create_chore_with_existing_tag_reuses_it() {
    let server = common::create_test_app().await;

    let existing_tag = common::create_tag(&server, "kitchen").await;

    let chore = common::create_chore_with_tags(&server, "Vacuum", "0 9 * * 1", &["kitchen"]).await;

    assert_eq!(chore.tags.len(), 1);
    assert_eq!(chore.tags[0].id, existing_tag.id);
}

#[tokio::test]
async fn test_create_chore_without_tags() {
    let server = common::create_test_app().await;

    let chore = common::create_chore(&server, "Vacuum", "0 9 * * 1").await;
    assert!(chore.tags.is_empty());
}

#[tokio::test]
async fn test_update_chore_set_tags() {
    let server = common::create_test_app().await;

    let chore = common::create_chore(&server, "Vacuum", "0 9 * * 1").await;
    assert!(chore.tags.is_empty());

    // Update with tags
    let body = serde_json::json!({ "tags": ["kitchen", "weekly"] });
    let response = server
        .put(&format!("/api/chores/{}", chore.id))
        .json(&body)
        .await;
    response.assert_status_ok();

    let updated: ChoreResponse = response.json();
    assert_eq!(updated.tags.len(), 2);
}

#[tokio::test]
async fn test_update_chore_replace_tags() {
    let server = common::create_test_app().await;

    let chore = common::create_chore_with_tags(&server, "Vacuum", "0 9 * * 1", &["kitchen"]).await;
    assert_eq!(chore.tags.len(), 1);

    // Replace tags
    let body = serde_json::json!({ "tags": ["bathroom", "daily"] });
    let response = server
        .put(&format!("/api/chores/{}", chore.id))
        .json(&body)
        .await;
    response.assert_status_ok();

    let updated: ChoreResponse = response.json();
    assert_eq!(updated.tags.len(), 2);
    let tag_names: Vec<&str> = updated.tags.iter().map(|t| t.name.as_str()).collect();
    assert!(tag_names.contains(&"bathroom"));
    assert!(tag_names.contains(&"daily"));
    assert!(!tag_names.contains(&"kitchen"));
}

#[tokio::test]
async fn test_update_chore_clear_tags() {
    let server = common::create_test_app().await;

    let chore = common::create_chore_with_tags(&server, "Vacuum", "0 9 * * 1", &["kitchen"]).await;

    // Clear tags with empty array
    let body = serde_json::json!({ "tags": [] });
    let response = server
        .put(&format!("/api/chores/{}", chore.id))
        .json(&body)
        .await;
    response.assert_status_ok();

    let updated: ChoreResponse = response.json();
    assert!(updated.tags.is_empty());
}

#[tokio::test]
async fn test_update_chore_without_tags_field_preserves_tags() {
    let server = common::create_test_app().await;

    let chore = common::create_chore_with_tags(&server, "Vacuum", "0 9 * * 1", &["kitchen"]).await;

    // Update only name, tags should be preserved
    let body = serde_json::json!({ "name": "Vacuum floors" });
    let response = server
        .put(&format!("/api/chores/{}", chore.id))
        .json(&body)
        .await;
    response.assert_status_ok();

    let updated: ChoreResponse = response.json();
    assert_eq!(updated.name, "Vacuum floors");
    assert_eq!(updated.tags.len(), 1);
    assert_eq!(updated.tags[0].name, "kitchen");
}

// ============================================================================
// Tags in Chore Responses
// ============================================================================

#[tokio::test]
async fn test_get_chore_includes_tags() {
    let server = common::create_test_app().await;

    let chore = common::create_chore_with_tags(&server, "Vacuum", "0 9 * * 1", &["kitchen"]).await;

    let response = server.get(&format!("/api/chores/{}", chore.id)).await;
    response.assert_status_ok();

    let fetched: ChoreResponse = response.json();
    assert_eq!(fetched.tags.len(), 1);
    assert_eq!(fetched.tags[0].name, "kitchen");
}

#[tokio::test]
async fn test_list_chores_includes_tags() {
    let server = common::create_test_app().await;

    common::create_chore_with_tags(&server, "Vacuum", "0 9 * * 1", &["kitchen"]).await;
    common::create_chore_with_tags(&server, "Dishes", "0 20 * * *", &["kitchen", "daily"]).await;

    let response = server.get("/api/chores").await;
    response.assert_status_ok();

    let body: PaginatedResponse<ChoreResponse> = response.json();
    assert_eq!(body.items.len(), 2);

    // Both chores should have their tags
    for chore in &body.items {
        assert!(!chore.tags.is_empty());
    }
}

#[tokio::test]
async fn test_due_chores_includes_tags() {
    let server = common::create_test_app().await;

    common::create_chore_with_tags(&server, "Vacuum", "0 9 * * 1", &["kitchen"]).await;

    let response = server.get("/api/chores/due?include_upcoming=true").await;
    response.assert_status_ok();

    let chores: Vec<ChoreWithDueResponse> = response.json();
    assert!(!chores.is_empty());
    assert_eq!(chores[0].tags.len(), 1);
    assert_eq!(chores[0].tags[0].name, "kitchen");
}

// ============================================================================
// Tag Filtering
// ============================================================================

#[tokio::test]
async fn test_list_chores_filter_by_tag() {
    let server = common::create_test_app().await;

    common::create_chore_with_tags(&server, "Vacuum", "0 9 * * 1", &["kitchen"]).await;
    common::create_chore_with_tags(&server, "Dishes", "0 20 * * *", &["kitchen", "daily"]).await;
    common::create_chore_with_tags(&server, "Mow lawn", "0 10 * * 6", &["outdoor"]).await;

    // Filter by "kitchen"
    let response = server.get("/api/chores?tag=kitchen").await;
    response.assert_status_ok();

    let body: PaginatedResponse<ChoreResponse> = response.json();
    assert_eq!(body.items.len(), 2);

    // Filter by "outdoor"
    let response = server.get("/api/chores?tag=outdoor").await;
    let body: PaginatedResponse<ChoreResponse> = response.json();
    assert_eq!(body.items.len(), 1);
    assert_eq!(body.items[0].name, "Mow lawn");

    // Filter by non-existent tag
    let response = server.get("/api/chores?tag=nonexistent").await;
    let body: PaginatedResponse<ChoreResponse> = response.json();
    assert!(body.items.is_empty());
}

#[tokio::test]
async fn test_due_chores_filter_by_tag() {
    let server = common::create_test_app().await;

    common::create_chore_with_tags(&server, "Vacuum", "0 9 * * 1", &["kitchen"]).await;
    common::create_chore_with_tags(&server, "Mow lawn", "0 10 * * 6", &["outdoor"]).await;

    let response = server
        .get("/api/chores/due?include_upcoming=true&tag=kitchen")
        .await;
    response.assert_status_ok();

    let chores: Vec<ChoreWithDueResponse> = response.json();
    // Should only contain the kitchen chore
    for chore in &chores {
        assert!(chore.tags.iter().any(|t| t.name == "kitchen"));
    }
}

// ============================================================================
// Cascade Behavior
// ============================================================================

#[tokio::test]
async fn test_delete_tag_removes_from_chores() {
    let server = common::create_test_app().await;

    let chore = common::create_chore_with_tags(&server, "Vacuum", "0 9 * * 1", &["kitchen"]).await;
    let tag_id = chore.tags[0].id;

    // Delete the tag
    let response = server.delete(&format!("/api/tags/{}", tag_id)).await;
    response.assert_status(StatusCode::NO_CONTENT);

    // Chore should no longer have the tag
    let response = server.get(&format!("/api/chores/{}", chore.id)).await;
    let fetched: ChoreResponse = response.json();
    assert!(fetched.tags.is_empty());
}

#[tokio::test]
async fn test_delete_chore_does_not_delete_tags() {
    let server = common::create_test_app().await;

    let chore = common::create_chore_with_tags(&server, "Vacuum", "0 9 * * 1", &["kitchen"]).await;

    // Delete the chore
    let response = server.delete(&format!("/api/chores/{}", chore.id)).await;
    response.assert_status(StatusCode::NO_CONTENT);

    // Tag should still exist
    let tags: Vec<TagResponse> = server.get("/api/tags").await.json();
    assert_eq!(tags.len(), 1);
    assert_eq!(tags[0].name, "kitchen");
}

// ============================================================================
// Tag Colors
// ============================================================================

#[tokio::test]
async fn test_create_tag_without_color() {
    let server = common::create_test_app().await;

    let tag = common::create_tag(&server, "kitchen").await;
    assert_eq!(tag.name, "kitchen");
    assert!(tag.color.is_none());
}

#[tokio::test]
async fn test_create_tag_with_valid_color() {
    let server = common::create_test_app().await;

    let tag = common::create_tag_with_color(&server, "kitchen", Some("sage")).await;
    assert_eq!(tag.name, "kitchen");
    assert_eq!(tag.color, Some("sage".to_string()));
}

#[tokio::test]
async fn test_create_tag_with_invalid_color_returns_400() {
    let server = common::create_test_app().await;

    let body = serde_json::json!({ "name": "kitchen", "color": "neon-pink" });
    let response = server.post("/api/tags").json(&body).await;
    response.assert_status(StatusCode::BAD_REQUEST);

    let problem: ProblemDetails = response.json();
    assert!(problem.detail.unwrap().contains("Invalid tag color"));
}

#[tokio::test]
async fn test_update_tag_set_color() {
    let server = common::create_test_app().await;

    let tag = common::create_tag(&server, "kitchen").await;
    assert!(tag.color.is_none());

    let body = serde_json::json!({ "color": "terracotta" });
    let response = server
        .put(&format!("/api/tags/{}", tag.id))
        .json(&body)
        .await;
    response.assert_status_ok();

    let updated: TagResponse = response.json();
    assert_eq!(updated.color, Some("terracotta".to_string()));
    assert_eq!(updated.name, "kitchen");
}

#[tokio::test]
async fn test_update_tag_clear_color() {
    let server = common::create_test_app().await;

    let tag = common::create_tag_with_color(&server, "kitchen", Some("sage")).await;
    assert_eq!(tag.color, Some("sage".to_string()));

    let body = serde_json::json!({ "color": null });
    let response = server
        .put(&format!("/api/tags/{}", tag.id))
        .json(&body)
        .await;
    response.assert_status_ok();

    let updated: TagResponse = response.json();
    assert!(updated.color.is_none());
}

#[tokio::test]
async fn test_update_tag_invalid_color_returns_400() {
    let server = common::create_test_app().await;

    let tag = common::create_tag(&server, "kitchen").await;

    let body = serde_json::json!({ "color": "rainbow" });
    let response = server
        .put(&format!("/api/tags/{}", tag.id))
        .json(&body)
        .await;
    response.assert_status(StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn test_update_tag_not_found() {
    let server = common::create_test_app().await;

    let fake_id = Uuid::new_v4();
    let body = serde_json::json!({ "color": "sage" });
    let response = server
        .put(&format!("/api/tags/{}", fake_id))
        .json(&body)
        .await;
    response.assert_status(StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_tag_color_in_chore_response() {
    let server = common::create_test_app().await;

    // Create a tag with color
    common::create_tag_with_color(&server, "kitchen", Some("sage")).await;

    // Create a chore using that tag name
    let chore = common::create_chore_with_tags(&server, "Vacuum", "0 9 * * 1", &["kitchen"]).await;

    // The tag in the chore response should have the color
    assert_eq!(chore.tags.len(), 1);
    assert_eq!(chore.tags[0].name, "kitchen");
    assert_eq!(chore.tags[0].color, Some("sage".to_string()));
}

#[tokio::test]
async fn test_update_tag_name() {
    let server = common::create_test_app().await;

    let tag = common::create_tag_with_color(&server, "kitchen", Some("sage")).await;

    let body = serde_json::json!({ "name": "Kitchen Area" });
    let response = server
        .put(&format!("/api/tags/{}", tag.id))
        .json(&body)
        .await;
    response.assert_status_ok();

    let updated: TagResponse = response.json();
    assert_eq!(updated.name, "Kitchen Area");
    assert_eq!(updated.color, Some("sage".to_string()));
}

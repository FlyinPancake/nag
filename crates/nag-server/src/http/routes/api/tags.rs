use axum::{Json, extract::Extension, http::StatusCode};
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::db::TagRepository;
use crate::http::models::{
    AppError, AppResult, CreateTagRequest, TagResponse, UpdateTagRequest, is_valid_tag_color,
};

const TAG: &str = "Tags";

/// List all tags
#[utoipa::path(
    get,
    path = "/tags",
    tag = TAG,
    responses(
        (status = 200, description = "List of all tags", body = Vec<TagResponse>)
    )
)]
pub async fn list_tags(
    Extension(pool): Extension<SqlitePool>,
) -> AppResult<Json<Vec<TagResponse>>> {
    let tags = TagRepository::list(&pool)
        .await
        .map_err(|e| AppError::Internal(e.into()))?;

    let items: Vec<TagResponse> = tags.into_iter().map(TagResponse::from).collect();

    Ok(Json(items))
}

/// Create a new tag
#[utoipa::path(
    post,
    path = "/tags",
    request_body = CreateTagRequest,
    tag = TAG,
    responses(
        (status = 201, description = "Tag created", body = TagResponse),
        (status = 400, description = "Invalid request"),
        (status = 409, description = "Tag with this name already exists")
    )
)]
pub async fn create_tag(
    Extension(pool): Extension<SqlitePool>,
    Json(body): Json<CreateTagRequest>,
) -> AppResult<(StatusCode, Json<TagResponse>)> {
    let name = body.name.trim();

    if name.is_empty() {
        return Err(AppError::BadRequest("Tag name cannot be empty".to_string()));
    }

    if name.len() > 50 {
        return Err(AppError::BadRequest(
            "Tag name cannot exceed 50 characters".to_string(),
        ));
    }

    // Validate color if provided
    if let Some(ref color) = body.color
        && !is_valid_tag_color(color)
    {
        return Err(AppError::BadRequest(format!(
            "Invalid tag color '{}'. Valid colors: terracotta, sage, ocean, amber, plum, clay, moss, slate, mauve, sand",
            color
        )));
    }

    if TagRepository::find_by_name(&pool, name)
        .await
        .map_err(|e| AppError::Internal(e.into()))?
        .is_some()
    {
        return Err(AppError::Conflict(format!(
            "Tag with name '{}' already exists",
            name
        )));
    }

    let tag = TagRepository::create(&pool, name, body.color.as_deref())
        .await
        .map_err(|e| AppError::Internal(e.into()))?;

    Ok((StatusCode::CREATED, Json(TagResponse::from(tag))))
}

/// Update a tag
#[utoipa::path(
    put,
    path = "/tags/{id}",
    request_body = UpdateTagRequest,
    params(
        ("id" = Uuid, Path, description = "Tag ID")
    ),
    tag = TAG,
    responses(
        (status = 200, description = "Tag updated", body = TagResponse),
        (status = 400, description = "Invalid request"),
        (status = 404, description = "Tag not found")
    )
)]
pub async fn update_tag(
    Extension(pool): Extension<SqlitePool>,
    axum::extract::Path(id): axum::extract::Path<Uuid>,
    Json(body): Json<UpdateTagRequest>,
) -> AppResult<Json<TagResponse>> {
    // Validate name if provided
    if let Some(ref name) = body.name {
        let trimmed = name.trim();
        if trimmed.is_empty() {
            return Err(AppError::BadRequest("Tag name cannot be empty".to_string()));
        }
        if trimmed.len() > 50 {
            return Err(AppError::BadRequest(
                "Tag name cannot exceed 50 characters".to_string(),
            ));
        }
    }

    // Validate color if provided (Some(Some("color")) = set, Some(None) = clear)
    if let Some(Some(ref color)) = body.color
        && !is_valid_tag_color(color)
    {
        return Err(AppError::BadRequest(format!(
            "Invalid tag color '{}'. Valid colors: terracotta, sage, ocean, amber, plum, clay, moss, slate, mauve, sand",
            color
        )));
    }

    let name_ref = body.name.as_deref().map(|n| n.trim());
    let color_ref = body.color.as_ref().map(|c| c.as_deref());

    let tag = TagRepository::update(&pool, id, name_ref, color_ref)
        .await
        .map_err(|e| AppError::Internal(e.into()))?
        .ok_or_else(|| AppError::NotFound(format!("Tag with id {} not found", id)))?;

    Ok(Json(TagResponse::from(tag)))
}

/// Delete a tag
#[utoipa::path(
    delete,
    path = "/tags/{id}",
    params(
        ("id" = Uuid, Path, description = "Tag ID")
    ),
    tag = TAG,
    responses(
        (status = 204, description = "Tag deleted"),
        (status = 404, description = "Tag not found")
    )
)]
pub async fn delete_tag(
    Extension(pool): Extension<SqlitePool>,
    axum::extract::Path(id): axum::extract::Path<Uuid>,
) -> AppResult<StatusCode> {
    let deleted = TagRepository::delete(&pool, id)
        .await
        .map_err(|e| AppError::Internal(e.into()))?;

    if deleted {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(AppError::NotFound(format!("Tag with id {} not found", id)))
    }
}

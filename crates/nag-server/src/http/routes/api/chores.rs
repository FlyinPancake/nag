use axum::{
    Json,
    extract::{Extension, Path, Query},
    http::StatusCode,
};
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::db::models::ScheduleType;
use crate::db::{
    ChoreRepository, CompletionRepository, TagRepository, chores::CreateChoreParams,
    chores::UpdateScheduleParams,
};
use crate::http::models::{
    AppError, AppResult, ChoreResponse, ChoreWithDueResponse, CompleteChoreRequest,
    CompletionResponse, CreateChoreRequest, DueChoresQuery, ListChoresQuery, ListCompletionsQuery,
    PaginatedResponse, ScheduleInput, UpdateChoreRequest,
};
use crate::services::ChoreService;

const TAG: &str = "Chores";

/// List all chores with pagination
#[utoipa::path(
    get,
    path = "/chores",
    params(
        ("cursor" = Option<Uuid>, Query, description = "Cursor for pagination"),
        ("limit" = Option<i64>, Query, description = "Maximum items to return (default 20)"),
        ("tag" = Option<String>, Query, description = "Filter by tag name")
    ),
    tag = TAG,
    responses(
        (status = 200, description = "List of chores", body = PaginatedResponse<ChoreResponse>)
    )
)]
pub async fn list_chores(
    Extension(pool): Extension<SqlitePool>,
    Query(query): Query<ListChoresQuery>,
) -> AppResult<Json<PaginatedResponse<ChoreResponse>>> {
    let chores = ChoreRepository::list(&pool, query.cursor, query.limit)
        .await
        .map_err(|e| AppError::Internal(e.into()))?;

    // Batch-load tags for all chores
    let chore_ids: Vec<Uuid> = chores.iter().map(|c| c.id).collect();
    let mut tags_map = TagRepository::get_tags_for_chores(&pool, &chore_ids)
        .await
        .map_err(|e| AppError::Internal(e.into()))?;

    // Build response items, optionally filtering by tag
    let mut items: Vec<ChoreResponse> = Vec::new();
    for chore in chores {
        let chore_tags = tags_map.remove(&chore.id).unwrap_or_default();

        // If tag filter is specified, skip chores that don't have the tag
        if let Some(ref filter_tag) = query.tag
            && !chore_tags
                .iter()
                .any(|t| t.name.eq_ignore_ascii_case(filter_tag))
        {
            continue;
        }

        items.push(ChoreResponse::from_chore_with_completion(chore, chore_tags));
    }

    let next_cursor = items.last().map(|c| c.id);

    Ok(Json(PaginatedResponse::new(items, next_cursor)))
}

/// Get chores that are due or overdue
#[utoipa::path(
    get,
    path = "/chores/due",
    params(
        ("include_upcoming" = Option<bool>, Query, description = "Include upcoming chores"),
        ("tag" = Option<String>, Query, description = "Filter by tag name")
    ),
    tag = TAG,
    responses(
        (status = 200, description = "List of due chores", body = Vec<ChoreWithDueResponse>)
    )
)]
pub async fn get_due_chores(
    Extension(pool): Extension<SqlitePool>,
    Query(query): Query<DueChoresQuery>,
) -> AppResult<Json<Vec<ChoreWithDueResponse>>> {
    let chores = ChoreService::get_due_chores(&pool, query.include_upcoming)
        .await
        .map_err(AppError::Internal)?;

    // Batch-load tags
    let chore_ids: Vec<Uuid> = chores.iter().map(|c| c.chore.id).collect();
    let mut tags_map = TagRepository::get_tags_for_chores(&pool, &chore_ids)
        .await
        .map_err(|e| AppError::Internal(e.into()))?;

    let mut items: Vec<ChoreWithDueResponse> = Vec::new();
    for info in chores {
        let chore_tags = tags_map.remove(&info.chore.id).unwrap_or_default();

        // If tag filter is specified, skip chores that don't have the tag
        if let Some(ref filter_tag) = query.tag
            && !chore_tags
                .iter()
                .any(|t| t.name.eq_ignore_ascii_case(filter_tag))
        {
            continue;
        }

        items.push(ChoreWithDueResponse::from_due_info(info, chore_tags));
    }

    Ok(Json(items))
}

/// Create a new chore
#[utoipa::path(
    post,
    path = "/chores",
    request_body = CreateChoreRequest,
    responses(
        (status = 201, description = "Chore created", body = ChoreResponse),
        (status = 400, description = "Invalid request")
    ),
    tag = TAG,
)]
pub async fn create_chore(
    Extension(pool): Extension<SqlitePool>,
    Json(body): Json<CreateChoreRequest>,
) -> AppResult<(StatusCode, Json<ChoreResponse>)> {
    // Validate and extract schedule parameters
    let params = match &body.schedule {
        ScheduleInput::Cron { cron_schedule } => {
            if let Err(e) = ChoreService::validate_cron_schedule(cron_schedule) {
                return Err(AppError::BadRequest(format!(
                    "Invalid cron schedule: {}",
                    e
                )));
            }
            CreateChoreParams {
                name: &body.name,
                description: body.description.as_deref(),
                schedule_type: ScheduleType::Cron,
                cron_schedule: Some(cron_schedule.as_str()),
                interval_days: None,
                interval_time_hour: None,
                interval_time_minute: None,
            }
        }
        ScheduleInput::Interval {
            interval_days,
            interval_time_hour,
            interval_time_minute,
        } => {
            if let Err(e) = ChoreService::validate_interval_schedule(
                *interval_days,
                *interval_time_hour,
                *interval_time_minute,
            ) {
                return Err(AppError::BadRequest(format!(
                    "Invalid interval schedule: {}",
                    e
                )));
            }
            CreateChoreParams {
                name: &body.name,
                description: body.description.as_deref(),
                schedule_type: ScheduleType::Interval,
                cron_schedule: None,
                interval_days: Some(*interval_days),
                interval_time_hour: *interval_time_hour,
                interval_time_minute: *interval_time_minute,
            }
        }
        ScheduleInput::OnceInAWhile {} => CreateChoreParams {
            name: &body.name,
            description: body.description.as_deref(),
            schedule_type: ScheduleType::OnceInAWhile,
            cron_schedule: None,
            interval_days: None,
            interval_time_hour: None,
            interval_time_minute: None,
        },
    };

    let chore = ChoreRepository::create(&pool, params)
        .await
        .map_err(|e| AppError::Internal(e.into()))?;

    // Set tags if provided
    let tags = if !body.tags.is_empty() {
        TagRepository::set_chore_tags(&pool, chore.id, &body.tags)
            .await
            .map_err(|e| AppError::Internal(e.into()))?
    } else {
        Vec::new()
    };

    Ok((
        StatusCode::CREATED,
        Json(ChoreResponse::from_chore(chore, tags)),
    ))
}

/// Get a single chore by ID
#[utoipa::path(
    get,
    path = "/chores/{id}",
    params(
        ("id" = Uuid, Path, description = "Chore ID")
    ),
    responses(
        (status = 200, description = "Chore found", body = ChoreResponse),
        (status = 404, description = "Chore not found")
    ),
    tag = TAG,
)]
pub async fn get_chore(
    Extension(pool): Extension<SqlitePool>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<ChoreResponse>> {
    let chore = ChoreRepository::get_by_id(&pool, id)
        .await
        .map_err(|e| AppError::Internal(e.into()))?
        .ok_or_else(|| AppError::NotFound(format!("Chore with id {} not found", id)))?;

    let tags = TagRepository::get_tags_for_chore(&pool, id)
        .await
        .map_err(|e| AppError::Internal(e.into()))?;

    Ok(Json(ChoreResponse::from_chore_with_completion(chore, tags)))
}

/// Update a chore
#[utoipa::path(
    put,
    path = "/chores/{id}",
    params(
        ("id" = Uuid, Path, description = "Chore ID")
    ),
    tag = TAG,
    request_body = UpdateChoreRequest,
    responses(
        (status = 200, description = "Chore updated", body = ChoreResponse),
        (status = 404, description = "Chore not found"),
        (status = 400, description = "Invalid request")
    )
)]
pub async fn update_chore(
    Extension(pool): Extension<SqlitePool>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateChoreRequest>,
) -> AppResult<Json<ChoreResponse>> {
    // Validate and convert schedule if provided
    let schedule_params = match &body.schedule {
        Some(ScheduleInput::Cron { cron_schedule }) => {
            if let Err(e) = ChoreService::validate_cron_schedule(cron_schedule) {
                return Err(AppError::BadRequest(format!(
                    "Invalid cron schedule: {}",
                    e
                )));
            }
            Some(UpdateScheduleParams {
                schedule_type: ScheduleType::Cron,
                cron_schedule: Some(cron_schedule.as_str()),
                interval_days: None,
                interval_time_hour: None,
                interval_time_minute: None,
            })
        }
        Some(ScheduleInput::Interval {
            interval_days,
            interval_time_hour,
            interval_time_minute,
        }) => {
            if let Err(e) = ChoreService::validate_interval_schedule(
                *interval_days,
                *interval_time_hour,
                *interval_time_minute,
            ) {
                return Err(AppError::BadRequest(format!(
                    "Invalid interval schedule: {}",
                    e
                )));
            }
            Some(UpdateScheduleParams {
                schedule_type: ScheduleType::Interval,
                cron_schedule: None,
                interval_days: Some(*interval_days),
                interval_time_hour: *interval_time_hour,
                interval_time_minute: *interval_time_minute,
            })
        }
        Some(ScheduleInput::OnceInAWhile {}) => Some(UpdateScheduleParams {
            schedule_type: ScheduleType::OnceInAWhile,
            cron_schedule: None,
            interval_days: None,
            interval_time_hour: None,
            interval_time_minute: None,
        }),
        None => None,
    };

    let chore = ChoreRepository::update(
        &pool,
        id,
        body.name.as_deref(),
        body.description.as_ref().map(|d| d.as_deref()),
        schedule_params,
    )
    .await
    .map_err(|e| AppError::Internal(e.into()))?
    .ok_or_else(|| AppError::NotFound(format!("Chore with id {} not found", id)))?;

    // Update tags if provided
    let tags = if let Some(ref tag_names) = body.tags {
        TagRepository::set_chore_tags(&pool, chore.id, tag_names)
            .await
            .map_err(|e| AppError::Internal(e.into()))?
    } else {
        TagRepository::get_tags_for_chore(&pool, chore.id)
            .await
            .map_err(|e| AppError::Internal(e.into()))?
    };

    Ok(Json(ChoreResponse::from_chore(chore, tags)))
}

/// Delete a chore
#[utoipa::path(
    delete,
    path = "/chores/{id}",
    params(
        ("id" = Uuid, Path, description = "Chore ID")
    ),
    tag = TAG,
    responses(
        (status = 204, description = "Chore deleted"),
        (status = 404, description = "Chore not found")
    )
)]
pub async fn delete_chore(
    Extension(pool): Extension<SqlitePool>,
    Path(id): Path<Uuid>,
) -> AppResult<StatusCode> {
    let deleted = ChoreRepository::delete(&pool, id)
        .await
        .map_err(|e| AppError::Internal(e.into()))?;

    if deleted {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(AppError::NotFound(format!(
            "Chore with id {} not found",
            id
        )))
    }
}

/// Mark a chore as complete
#[utoipa::path(
    post,
    path = "/chores/{id}/complete",
    params(
        ("id" = Uuid, Path, description = "Chore ID")
    ),
    tag = TAG,
    request_body = CompleteChoreRequest,
    responses(
        (status = 201, description = "Completion recorded", body = CompletionResponse),
        (status = 404, description = "Chore not found")
    )
)]
pub async fn complete_chore(
    Extension(pool): Extension<SqlitePool>,
    Path(id): Path<Uuid>,
    Json(body): Json<CompleteChoreRequest>,
) -> AppResult<(StatusCode, Json<CompletionResponse>)> {
    // Check if chore exists
    if !CompletionRepository::chore_exists(&pool, id)
        .await
        .map_err(|e| AppError::Internal(e.into()))?
    {
        return Err(AppError::NotFound(format!(
            "Chore with id {} not found",
            id
        )));
    }

    let completion =
        CompletionRepository::create(&pool, id, body.completed_at, body.notes.as_deref())
            .await
            .map_err(|e| AppError::Internal(e.into()))?;

    Ok((
        StatusCode::CREATED,
        Json(CompletionResponse::from(completion)),
    ))
}

/// List completions for a chore
#[utoipa::path(
    get,
    path = "/chores/{id}/completions",
    params(
        ("id" = Uuid, Path, description = "Chore ID"),
        ("cursor" = Option<Uuid>, Query, description = "Cursor for pagination"),
        ("limit" = Option<i64>, Query, description = "Maximum items to return")
    ),
    tag = TAG,
    responses(
        (status = 200, description = "List of completions", body = PaginatedResponse<CompletionResponse>),
        (status = 404, description = "Chore not found")
    )
)]
pub async fn list_completions(
    Extension(pool): Extension<SqlitePool>,
    Path(id): Path<Uuid>,
    Query(query): Query<ListCompletionsQuery>,
) -> AppResult<Json<PaginatedResponse<CompletionResponse>>> {
    // Check if chore exists
    if !CompletionRepository::chore_exists(&pool, id)
        .await
        .map_err(|e| AppError::Internal(e.into()))?
    {
        return Err(AppError::NotFound(format!(
            "Chore with id {} not found",
            id
        )));
    }

    let completions = CompletionRepository::list_for_chore(&pool, id, query.cursor, query.limit)
        .await
        .map_err(|e| AppError::Internal(e.into()))?;

    let next_cursor = completions.last().map(|c| c.id);
    let items: Vec<CompletionResponse> = completions
        .into_iter()
        .map(CompletionResponse::from)
        .collect();

    Ok(Json(PaginatedResponse::new(items, next_cursor)))
}

/// Delete a completion record
#[utoipa::path(
    delete,
    path = "/completions/{id}",
    params(
        ("id" = Uuid, Path, description = "Completion ID")
    ),
    tag = TAG,
    responses(
        (status = 204, description = "Completion deleted"),
        (status = 404, description = "Completion not found")
    )
)]
pub async fn delete_completion(
    Extension(pool): Extension<SqlitePool>,
    Path(id): Path<Uuid>,
) -> AppResult<StatusCode> {
    let deleted = CompletionRepository::delete(&pool, id)
        .await
        .map_err(|e| AppError::Internal(e.into()))?;

    if deleted {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(AppError::NotFound(format!(
            "Completion with id {} not found",
            id
        )))
    }
}

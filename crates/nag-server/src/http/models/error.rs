use axum::{
    http::{StatusCode, Uri},
    response::{IntoResponse, Response},
};
use problem_details::ProblemDetails;
use utoipa::ToSchema;

/// Application error type that converts to RFC 7807 Problem Details responses.
#[derive(Debug, thiserror::Error)]
#[allow(dead_code)]
pub enum AppError {
    #[error("Resource not found: {0}")]
    NotFound(String),

    #[error("Bad request: {0}")]
    BadRequest(String),

    #[error("Unauthorized: {0}")]
    Unauthorized(String),

    #[error("Forbidden: {0}")]
    Forbidden(String),

    #[error("Conflict: {0}")]
    Conflict(String),

    #[error("Unprocessable entity: {0}")]
    UnprocessableEntity(String),

    #[error("Internal server error")]
    Internal(#[from] color_eyre::eyre::Error),
}

impl AppError {
    fn status_code(&self) -> StatusCode {
        match self {
            AppError::NotFound(_) => StatusCode::NOT_FOUND,
            AppError::BadRequest(_) => StatusCode::BAD_REQUEST,
            AppError::Unauthorized(_) => StatusCode::UNAUTHORIZED,
            AppError::Forbidden(_) => StatusCode::FORBIDDEN,
            AppError::Conflict(_) => StatusCode::CONFLICT,
            AppError::UnprocessableEntity(_) => StatusCode::UNPROCESSABLE_ENTITY,
            AppError::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }

    fn problem_type(&self) -> &'static str {
        match self {
            AppError::NotFound(_) => "https://httpstatuses.io/404",
            AppError::BadRequest(_) => "https://httpstatuses.io/400",
            AppError::Unauthorized(_) => "https://httpstatuses.io/401",
            AppError::Forbidden(_) => "https://httpstatuses.io/403",
            AppError::Conflict(_) => "https://httpstatuses.io/409",
            AppError::UnprocessableEntity(_) => "https://httpstatuses.io/422",
            AppError::Internal(_) => "https://httpstatuses.io/500",
        }
    }

    fn title(&self) -> &'static str {
        match self {
            AppError::NotFound(_) => "Not Found",
            AppError::BadRequest(_) => "Bad Request",
            AppError::Unauthorized(_) => "Unauthorized",
            AppError::Forbidden(_) => "Forbidden",
            AppError::Conflict(_) => "Conflict",
            AppError::UnprocessableEntity(_) => "Unprocessable Entity",
            AppError::Internal(_) => "Internal Server Error",
        }
    }

    fn detail(&self) -> String {
        match self {
            AppError::Internal(_) => "An unexpected error occurred".to_string(),
            other => other.to_string(),
        }
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let status = self.status_code();

        // Log internal errors
        if let AppError::Internal(ref e) = self {
            tracing::error!(error = ?e, "Internal server error");
        }

        let problem = ProblemDetails::new()
            .with_type(self.problem_type().parse::<Uri>().unwrap())
            .with_status(status)
            .with_title(self.title())
            .with_detail(self.detail());

        problem.into_response()
    }
}

/// Type alias for Results that return AppError
#[allow(dead_code)]
pub type AppResult<T> = Result<T, AppError>;

/// RFC 7807 Problem Details response schema for OpenAPI documentation.
/// This is a separate struct for utoipa since AppError contains types
/// that can't derive ToSchema.
#[derive(ToSchema)]
#[schema(
    title = "ProblemDetails",
    description = "RFC 7807 Problem Details response"
)]
#[allow(dead_code)]
pub struct ProblemDetailsSchema {
    /// A URI reference that identifies the problem type
    #[schema(example = "https://httpstatuses.io/404")]
    pub r#type: Option<String>,

    /// A short, human-readable summary of the problem type
    #[schema(example = "Not Found")]
    pub title: Option<String>,

    /// The HTTP status code
    #[schema(example = 404)]
    pub status: Option<u16>,

    /// A human-readable explanation specific to this occurrence
    #[schema(example = "Resource not found: user with id 123")]
    pub detail: Option<String>,

    /// A URI reference that identifies the specific occurrence
    pub instance: Option<String>,
}

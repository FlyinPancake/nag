mod chores;

use utoipa_axum::{router::OpenApiRouter, routes};

pub fn router() -> OpenApiRouter {
    OpenApiRouter::new()
        // Chore routes
        .routes(routes!(chores::list_chores))
        .routes(routes!(chores::get_due_chores))
        .routes(routes!(chores::create_chore))
        .routes(routes!(chores::get_chore))
        .routes(routes!(chores::update_chore))
        .routes(routes!(chores::delete_chore))
        .routes(routes!(chores::complete_chore))
        .routes(routes!(chores::list_completions))
        // Completion routes
        .routes(routes!(chores::delete_completion))
}

//! Static file serving with rust-embed for SPA support
//!
//! Embeds the frontend build from `frontend/dist` into the binary.
//! Supports SPA routing by falling back to index.html for non-file paths.

use axum::{
    body::Body,
    http::{Request, StatusCode, header},
    response::{IntoResponse, Response},
};
use rust_embed::RustEmbed;

/// Embedded frontend assets from the dist folder.
/// The `frontend/dist` folder must exist (can be empty) for compilation.
/// In dev mode without a build, static requests will return 404.
#[derive(RustEmbed)]
#[folder = "../../frontend/dist"]
struct Assets;

/// Fallback handler for serving static files and SPA routing.
///
/// - Serves exact file matches with appropriate MIME types
/// - Falls back to index.html for SPA client-side routing
/// - Returns 404 if dist folder is missing or index.html doesn't exist
pub async fn static_handler(req: Request<Body>) -> Response {
    let path = req.uri().path().trim_start_matches('/');

    // Try to serve the exact file first
    if let Some(response) = serve_file(path) {
        return response;
    }

    // For SPA routing: if path doesn't look like a file, serve index.html
    // A "file path" typically has an extension in the last segment
    if !path_looks_like_file(path)
        && let Some(response) = serve_file("index.html")
    {
        return response;
    }

    // Nothing found - return 404
    (StatusCode::NOT_FOUND, "Not found").into_response()
}

/// Attempt to serve a file from the embedded assets.
fn serve_file(path: &str) -> Option<Response> {
    let asset = Assets::get(path)?;

    let mime = mime_guess::from_path(path)
        .first_or_octet_stream()
        .to_string();

    let body = Body::from(asset.data.into_owned());

    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, mime)
        .body(body)
        .ok()
}

/// Check if a path looks like it's requesting a specific file (has an extension).
fn path_looks_like_file(path: &str) -> bool {
    path.rsplit('/')
        .next()
        .map(|segment| segment.contains('.'))
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_path_looks_like_file() {
        // Files with extensions
        assert!(path_looks_like_file("index.html"));
        assert!(path_looks_like_file("assets/main.js"));
        assert!(path_looks_like_file("images/logo.png"));
        assert!(path_looks_like_file("deeply/nested/path/file.css"));

        // Routes (no extension in last segment)
        assert!(!path_looks_like_file(""));
        assert!(!path_looks_like_file("chores"));
        assert!(!path_looks_like_file("chores/123"));
        assert!(!path_looks_like_file("settings/profile"));
    }
}

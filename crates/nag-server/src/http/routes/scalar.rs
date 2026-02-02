use axum::{Router, response::Html, routing::get};

pub fn router() -> Router {
    Router::new().route("/", get(scalar_ui))
}

async fn scalar_ui() -> Html<String> {
    let html_content = r#"
        <!doctype html>
        <html>
          <head>
            <title>Nag API Reference</title>
            <meta charset="utf-8" />
            <meta
              name="viewport"
              content="width=device-width, initial-scale=1" />
          </head>
          <body>
            <div id="app"></div>
            <!-- Load the Script -->
            <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
            <!-- Initialize the Scalar API Reference -->
            <script>
              Scalar.createApiReference('#app', {
                // The URL of the OpenAPI/Swagger document
                url: '/docs/schema.json',
                // Avoid CORS issues
                // proxyUrl: 'https://proxy.scalar.com',
              })
            </script>
          </body>
        </html>
        "#
    .to_string();
    Html(html_content)
}

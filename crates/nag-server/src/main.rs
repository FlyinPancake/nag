#![deny(unused_must_use)]

mod config;

use envconfig::Envconfig;
use nag_server::{db, http};
use tokio::net::TcpListener;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

fn init_tracing(json_logs: bool) {
    let env_filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| "nag_server=info,tower_http=debug".into());

    if json_logs {
        tracing_subscriber::registry()
            .with(env_filter)
            .with(tracing_subscriber::fmt::layer().json())
            .init();
    } else {
        tracing_subscriber::registry()
            .with(env_filter)
            .with(tracing_subscriber::fmt::layer())
            .init();
    }
}

#[tokio::main]
async fn main() -> color_eyre::Result<()> {
    color_eyre::install()?;

    // Load .env file (ignore if not present)
    let _ = dotenvy::dotenv();

    // Initialize configuration
    let config = config::Config::init_from_env()?;

    // Initialize tracing
    init_tracing(config.json_logs);

    // Initialize database
    let pool = db::create_pool(&config.database_url).await?;
    tracing::info!("Database connected and migrations applied");

    // Build the application
    let app = http::build_app(pool);

    // Bind and serve
    let addr = format!("0.0.0.0:{}", config.server_port);
    let listener = TcpListener::bind(&addr).await?;
    tracing::info!("Listening on {}", addr);

    axum::serve(listener, app).await?;

    Ok(())
}

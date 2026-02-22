#![deny(unused_must_use)]

mod config;

use std::sync::Arc;

use envconfig::Envconfig;
use nag_server::db::models::NotificationChannel;
use nag_server::services::{
    NotificationRuntimeConfig, OidcService, TelegramChannel, run_dispatcher, run_event_generator,
};
use nag_server::{db, http};
use tokio::net::TcpListener;
use tower_sessions_sqlx_store::SqliteStore;
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
    config.validate_oidc()?;
    config.validate_notifications()?;

    // Initialize tracing
    init_tracing(config.json_logs);

    // Initialize database
    let pool = db::create_pool(&config.database_url).await?;
    tracing::info!("Database connected and migrations applied");

    // Conditionally set up OIDC auth and session store
    let (oidc, session_store) = if config.auth_enabled {
        let oidc = OidcService::discover(
            config.oidc_issuer_url.as_ref().unwrap(),
            config.oidc_client_id.as_ref().unwrap(),
            config.oidc_client_secret.as_ref().unwrap(),
            config.oidc_redirect_url.as_ref().unwrap(),
        )
        .await?;

        let session_store = SqliteStore::new(pool.clone());
        session_store.migrate().await?;

        (Some(Arc::new(oidc)), Some(session_store))
    } else {
        tracing::warn!("Auth disabled — all API routes are publicly accessible");
        (None, None)
    };

    // Build the application state
    let state = http::AppState { pool, oidc };

    if config.notifications_enabled {
        let runtime_config = NotificationRuntimeConfig {
            poll_interval_seconds: config.notification_poll_interval_seconds,
            dispatch_interval_seconds: config.notification_dispatch_interval_seconds,
            max_attempts: config.notification_max_attempts,
            batch_size: config.notification_batch_size,
        };

        let channels = vec![NotificationChannel::Telegram];
        let telegram = Arc::new(
            TelegramChannel::new(
                config.telegram_bot_token.clone().unwrap_or_default(),
                config.telegram_chat_id.clone().unwrap_or_default(),
            )
            .map_err(|e| color_eyre::eyre::eyre!(e))?,
        );

        let generator_pool = state.pool.clone();
        let generator_config = runtime_config.clone();
        tokio::spawn(async move {
            tracing::info!("Notification generator started");
            run_event_generator(generator_pool, channels, generator_config).await;
        });

        let dispatcher_pool = state.pool.clone();
        let dispatcher_config = runtime_config;
        let dispatcher_telegram = telegram.clone();
        tokio::spawn(async move {
            tracing::info!("Notification dispatcher started");
            run_dispatcher(
                dispatcher_pool,
                vec![dispatcher_telegram],
                dispatcher_config,
            )
            .await;
        });

        let callback_pool = state.pool.clone();
        let callback_telegram = telegram.clone();
        tokio::spawn(async move {
            tracing::info!("Telegram callback handler started");
            callback_telegram.run_callback_handler(callback_pool).await;
        });
    }

    // Build the application
    let app = http::build_app(state, session_store);

    // Bind and serve
    let addr = format!("0.0.0.0:{}", config.server_port);
    let listener = TcpListener::bind(&addr).await?;
    tracing::info!("Listening on {}", addr);

    axum::serve(listener, app).await?;

    Ok(())
}

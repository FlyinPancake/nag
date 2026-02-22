use color_eyre::eyre::bail;
use envconfig::Envconfig;

#[derive(Debug, Clone, Envconfig)]
pub struct Config {
    #[envconfig(from = "DATABASE_URL", default = "sqlite::memory:")]
    pub database_url: String,
    #[envconfig(from = "SERVER_PORT", default = "3000")]
    pub server_port: u16,
    #[envconfig(from = "JSON_LOGS", default = "false")]
    pub json_logs: bool,

    /// Enable OIDC authentication. When `false`, all API routes are publicly
    /// accessible and `/auth/*` endpoints are not registered.
    #[envconfig(from = "AUTH_ENABLED", default = "false")]
    pub auth_enabled: bool,

    // OIDC configuration — required only when AUTH_ENABLED=true
    #[envconfig(from = "OIDC_ISSUER_URL")]
    pub oidc_issuer_url: Option<String>,
    #[envconfig(from = "OIDC_CLIENT_ID")]
    pub oidc_client_id: Option<String>,
    #[envconfig(from = "OIDC_CLIENT_SECRET")]
    pub oidc_client_secret: Option<String>,
    #[envconfig(from = "OIDC_REDIRECT_URL")]
    pub oidc_redirect_url: Option<String>,

    #[envconfig(from = "NOTIFICATIONS_ENABLED", default = "false")]
    pub notifications_enabled: bool,
    #[envconfig(from = "NOTIFICATION_POLL_INTERVAL_SECONDS", default = "60")]
    pub notification_poll_interval_seconds: u64,
    #[envconfig(from = "NOTIFICATION_DISPATCH_INTERVAL_SECONDS", default = "15")]
    pub notification_dispatch_interval_seconds: u64,
    #[envconfig(from = "NOTIFICATION_MAX_ATTEMPTS", default = "5")]
    pub notification_max_attempts: i32,
    #[envconfig(from = "NOTIFICATION_BATCH_SIZE", default = "50")]
    pub notification_batch_size: i64,

    #[envconfig(from = "TELEGRAM_BOT_TOKEN")]
    pub telegram_bot_token: Option<String>,
    #[envconfig(from = "TELEGRAM_CHAT_ID")]
    pub telegram_chat_id: Option<String>,
}

impl Config {
    /// Validate that all required OIDC fields are present when auth is enabled.
    /// Returns an error listing any missing fields.
    pub fn validate_oidc(&self) -> color_eyre::Result<()> {
        if !self.auth_enabled {
            return Ok(());
        }

        let missing: Vec<&str> = [
            (self.oidc_issuer_url.is_none(), "OIDC_ISSUER_URL"),
            (self.oidc_client_id.is_none(), "OIDC_CLIENT_ID"),
            (self.oidc_client_secret.is_none(), "OIDC_CLIENT_SECRET"),
            (self.oidc_redirect_url.is_none(), "OIDC_REDIRECT_URL"),
        ]
        .into_iter()
        .filter(|(is_missing, _)| *is_missing)
        .map(|(_, name)| name)
        .collect();

        if !missing.is_empty() {
            bail!(
                "AUTH_ENABLED=true but the following required environment variables are not set: {}",
                missing.join(", ")
            );
        }

        Ok(())
    }

    /// Validate that notification channel config is present when notifications are enabled.
    pub fn validate_notifications(&self) -> color_eyre::Result<()> {
        if !self.notifications_enabled {
            return Ok(());
        }

        let missing: Vec<&str> = [
            (self.telegram_bot_token.is_none(), "TELEGRAM_BOT_TOKEN"),
            (self.telegram_chat_id.is_none(), "TELEGRAM_CHAT_ID"),
        ]
        .into_iter()
        .filter(|(is_missing, _)| *is_missing)
        .map(|(_, name)| name)
        .collect();

        if !missing.is_empty() {
            bail!(
                "NOTIFICATIONS_ENABLED=true but the following required environment variables are not set: {}",
                missing.join(", ")
            );
        }

        Ok(())
    }
}

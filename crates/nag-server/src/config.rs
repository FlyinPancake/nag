use envconfig::Envconfig;

#[derive(Debug, Clone, Envconfig)]
pub struct Config {
    #[envconfig(from = "DATABASE_URL", default = "sqlite::memory:")]
    pub database_url: String,
    #[envconfig(from = "SERVER_PORT", default = "3000")]
    pub server_port: u16,
    #[envconfig(from = "JSON_LOGS", default = "false")]
    pub json_logs: bool,
}

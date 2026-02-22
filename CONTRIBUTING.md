# Contribuing to Nag

## Tech Stack

- Backend: Rust, Axum, SQLx, SQLite
- Frontend: React 19, TypeScript, Vite, Tailwind CSS v4
- API docs: OpenAPI via utoipa
- Tooling: `mise` (task runner), `bun` (frontend)

## Quick Start

### Prerequisites

- Rust (stable)
- `mise` (recommended)
- `bun`
- `sqlite3` (for helper tasks)

### 1) Install tools

If you use `mise`, run:

```bash
mise install
```

### 2) Configure environment

Create `.env` in repo root (or update existing):

```env
DATABASE_URL=sqlite:nag.db?mode=rwc
SERVER_PORT=3000
RUST_LOG=nag_server=info,tower_http=debug
JSON_LOGS=false

AUTH_ENABLED=true
OIDC_ISSUER_URL=http://localhost:9000
OIDC_CLIENT_ID=nag-dev
OIDC_CLIENT_SECRET=nag-dev-secret
OIDC_REDIRECT_URL=http://localhost:3000/auth/callback

NOTIFICATIONS_ENABLED=true
TELEGRAM_BOT_TOKEN=<your-bot-token>
TELEGRAM_CHAT_ID=<your-chat-id>
NOTIFICATION_POLL_INTERVAL_SECONDS=60
NOTIFICATION_DISPATCH_INTERVAL_SECONDS=15
NOTIFICATION_MAX_ATTEMPTS=5
NOTIFICATION_BATCH_SIZE=50
```

If you do not want auth locally, set:

```env
AUTH_ENABLED=false
```

### 3) Run the app

Run backend + frontend + local OIDC provider:

```bash
mise run dev
```

Default URLs:

- App/API: `http://localhost:3000`
- Frontend dev server: typically `http://localhost:5173` (or next free port)
- OIDC dev provider: `http://localhost:9000`

## Telegram Notifications

When notifications are enabled, the backend:

1. Finds due chores on a polling interval
2. Queues deliveries
3. Sends Telegram messages
4. Attaches an inline **Mark done** button

Clicking **Mark done** creates a completion in `nag`.

### Get your `TELEGRAM_CHAT_ID`

1. Send a message to your bot in Telegram
2. Run:

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getUpdates"
```

3. Use `message.chat.id` as `TELEGRAM_CHAT_ID`

Quick direct check:

```bash
curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
  --data-urlencode "chat_id=$TELEGRAM_CHAT_ID" \
  --data-urlencode "text=nag direct test"
```

## Useful Commands

### Development

```bash
mise run dev
mise run dev-backend
mise run dev-frontend
mise run dev-oidc
```

### Build and test

```bash
cargo test -p nag-server
cargo build -p nag-server

cd frontend
bun run test:run
bun run build
```

### Database and migrations

```bash
mise run run-migrations
mise run add-migration -- "description"
```

### Seed and time-shift helpers

```bash
mise run seed-chores -- --profile default
mise run backdate-chores -- --days 3
```

- `seed-chores` inserts demo chores/tags/completions
- `backdate-chores` shifts chores and completions into the past (useful for due-notification testing)

## API Docs

- OpenAPI schema: `http://localhost:3000/docs/schema.json`
- Docs UI: `http://localhost:3000/docs`

## Project Layout

```text
nag/
├── crates/nag-server/   # Rust backend
├── frontend/            # React frontend
├── .mise/tasks/         # local helper tasks
├── mise.toml            # task definitions
└── dev/oidc-provider/   # local OIDC provider
```

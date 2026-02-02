# AGENTS.md - Coding Agent Instructions

This document provides guidelines for AI coding agents working on the **nag** project.

## Project Overview

**nag** is a chore/task reminder application with:
- **Backend**: Rust (Axum 0.8 + SQLite via SQLx)
- **Frontend**: React 19 + TypeScript + Vite + TailwindCSS v4
- **Task Runner**: mise (manages bun, sqlx-cli)

Monorepo structure with frontend embedded into the Rust binary for production.

## Build, Lint, Test Commands

### Backend (Rust)

```bash
cargo build                           # Debug build
cargo build --release                 # Release build
cargo run -p nag-server               # Run server (port 3000)
cargo test                            # Run all tests
cargo test -p nag-server              # Run nag-server tests only
cargo test test_create_chore          # Run single test by name
cargo test api_chores::               # Run tests in a module
cargo clippy                          # Lint
cargo fmt                             # Format code
cargo fmt --check                     # Check formatting
```

### Frontend (TypeScript)

```bash
cd frontend
bun install                           # Install dependencies
bun run dev                           # Dev server (port 5173, proxies to backend)
bun run build                         # Production build (tsc && vite build)
bun run lint                          # Lint with oxlint
bun run generate-api-types            # Generate TS types from OpenAPI (requires backend running)
```

### Mise Tasks (Preferred)

```bash
mise run dev                          # Run both frontend and backend dev servers
mise run dev-backend                  # Backend with hot reload
mise run dev-frontend                 # Frontend dev server
mise run build-frontend               # Build frontend assets
mise run gen-oapi                     # Generate TypeScript API types
mise run run-migrations               # Run database migrations
mise run add-migration "description"  # Create new migration
```

### Database

```bash
# Migrations are in crates/nag-server/migrations/
sqlx migrate run --source ./crates/nag-server/migrations
sqlx migrate add --source ./crates/nag-server/migrations -r "description"
```

## Code Style Guidelines

### Rust

**Imports** - Order: std, external crates, local modules (separated by blank lines):
```rust
use std::collections::HashMap;

use axum::{Router, Json};
use serde::{Deserialize, Serialize};

use crate::db::models::Chore;
use crate::services::ChoreService;
```

**Naming**:
- `snake_case`: functions, variables, modules
- `PascalCase`: types, structs, enums, traits
- `SCREAMING_SNAKE_CASE`: constants

**Error Handling**:
- Use `thiserror` for custom error types
- Use `color_eyre::Result` for fallible functions
- HTTP errors use `AppError` enum (converts to RFC 7807 Problem Details)
- Log internal errors with `tracing::error!`

**Documentation**:
- `///` for public API documentation
- `//!` for module-level docs
- Include examples for complex functions

**Architecture** (layered):
- `http/routes/` - HTTP handlers, request/response DTOs
- `services/` - Business logic
- `db/` - Database queries and models

**Testing**:
- Integration tests in `crates/nag-server/tests/`
- Use `#[tokio::test]` for async tests
- Use `common::create_test_app()` for in-memory SQLite
- Test helpers in `tests/common/mod.rs`

### TypeScript/React

**Imports** - Order: React, external packages, local modules (use `@/` alias):
```typescript
import { useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { choresApi } from "@/lib/api";
import type { Chore } from "@/lib/api";
```

**Type Imports** - Use `type` keyword for type-only imports:
```typescript
import type { Chore, ChoreWithDue } from "@/lib/api";
```

**Naming**:
- `PascalCase`: Components, types, interfaces
- `camelCase`: functions, variables, hooks
- `kebab-case`: file names (e.g., `chore-card.tsx`)
- Hooks: `use-*.ts` files, `use*` function names

**Components**:
- Functional components with explicit prop types
- Props interface named `{ComponentName}Props`
- Export component and skeleton loader if applicable

```typescript
interface ChoreCardProps {
  chore: ChoreWithDue;
  onComplete: (id: string) => Promise<void>;
}

export function ChoreCard({ chore, onComplete }: ChoreCardProps) {
  // ...
}
```

**State Management**:
- TanStack Query for server state
- React Context for global UI state (theme, form dialogs)
- Local state with `useState` for component-specific state

**API Types**:
- Generated from OpenAPI spec in `src/generated/api-types.ts`
- Re-exported with aliases in `src/lib/api.ts`
- Never manually edit generated files

**Styling**:
- TailwindCSS v4 with custom theme in `src/index.css`
- Use `cn()` utility for conditional classes
- Component variants via `class-variance-authority`

## Project Structure

```
nag/
├── Cargo.toml                    # Rust workspace
├── mise.toml                     # Task runner config
├── crates/nag-server/
│   ├── Cargo.toml
│   ├── migrations/               # SQLx migrations
│   ├── src/
│   │   ├── main.rs              # Entry point
│   │   ├── lib.rs               # Library exports (for tests)
│   │   ├── config.rs            # Environment config
│   │   ├── db/                  # Database layer
│   │   ├── http/                # HTTP layer (routes, models, middleware)
│   │   └── services/            # Business logic
│   └── tests/                   # Integration tests
└── frontend/
    ├── package.json
    ├── tsconfig.json            # Strict mode, @/* alias
    ├── vite.config.ts
    └── src/
        ├── components/          # React components
        │   └── ui/              # shadcn/ui base components
        ├── hooks/               # Custom React hooks
        ├── lib/                 # Utilities (api, cron, date, utils)
        ├── routes/              # TanStack Router pages
        └── generated/           # Auto-generated (do not edit)
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `sqlite::memory:` | SQLite connection string |
| `SERVER_PORT` | `3000` | Server port |
| `RUST_LOG` | `nag_server=info,tower_http=debug` | Log level |
| `JSON_LOGS` | `false` | JSON log format |

## API Conventions

- REST endpoints under `/api/`
- OpenAPI schema at `/docs/schema.json`
- Errors return RFC 7807 Problem Details
- Pagination uses cursor-based approach with `cursor` and `limit` params
- Timestamps in ISO 8601 / RFC 3339 format (UTC)

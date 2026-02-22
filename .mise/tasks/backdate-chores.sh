#!/usr/bin/env bash
#MISE description="Backdate chores and completions for due-notification testing"

set -euo pipefail

days=1
db_input="${DATABASE_URL:-sqlite://./nag.db}"
chore_id=""
dry_run=false

usage() {
  cat <<'EOF'
Usage: mise run backdate-chores -- [options]

Options:
  --days <N>          Backdate by N days (default: 1)
  --database <DB>     SQLite DB path or URL (default: DATABASE_URL or sqlite://./nag.db)
  --chore-id <UUID>   Backdate only one chore (and its completions)
  --dry-run           Print affected rows without updating
  -h, --help          Show this help

Examples:
  mise run backdate-chores -- --days 3
  mise run backdate-chores -- --database sqlite://./nag.db --days 7
  mise run backdate-chores -- --chore-id 00000000-0000-0000-0000-000000000000 --days 2
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --days)
      shift
      days="${1:-}"
      ;;
    --database)
      shift
      db_input="${1:-}"
      ;;
    --chore-id)
      shift
      chore_id="${1:-}"
      ;;
    --dry-run)
      dry_run=true
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
  shift
done

if ! [[ "$days" =~ ^[0-9]+$ ]] || [[ "$days" -lt 1 ]]; then
  echo "--days must be a positive integer" >&2
  exit 1
fi

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "sqlite3 is required but was not found in PATH" >&2
  exit 1
fi

if [[ "$db_input" == "sqlite::memory:" ]]; then
  echo "sqlite::memory: is not supported by this task; use a file-backed database" >&2
  exit 1
fi

db_path="$db_input"
if [[ "$db_path" == sqlite://* ]]; then
  db_path="${db_path#sqlite://}"
fi

if [[ "$db_path" == file:* ]]; then
  db_path="${db_path#file:}"
fi

if [[ ! -f "$db_path" ]]; then
  echo "Database file not found: $db_path" >&2
  exit 1
fi

timestamp_expr="strftime('%Y-%m-%dT%H:%M:%SZ','now','-${days} day')"

chore_where=""
completion_where=""
if [[ -n "$chore_id" ]]; then
  chore_where=" WHERE id = '$chore_id'"
  completion_where=" WHERE chore_id = '$chore_id'"
fi

echo "Database: $db_path"
echo "Backdating by: ${days} day(s)"
if [[ -n "$chore_id" ]]; then
  echo "Scope: chore $chore_id"
else
  echo "Scope: all chores"
fi

if [[ "$dry_run" == true ]]; then
  echo
  echo "[dry-run] chores that would be updated:"
  sqlite3 "$db_path" "SELECT id, name, created_at, updated_at FROM chores${chore_where} ORDER BY name;"
  echo
  echo "[dry-run] completions that would be updated:"
  sqlite3 "$db_path" "SELECT id, chore_id, completed_at, created_at FROM completions${completion_where} ORDER BY completed_at DESC LIMIT 50;"
  exit 0
fi

chore_count_before=$(sqlite3 "$db_path" "SELECT COUNT(*) FROM chores${chore_where};")
completion_count_before=$(sqlite3 "$db_path" "SELECT COUNT(*) FROM completions${completion_where};")

sqlite3 "$db_path" "UPDATE chores SET created_at = ${timestamp_expr}, updated_at = ${timestamp_expr}${chore_where};"
sqlite3 "$db_path" "UPDATE completions SET completed_at = ${timestamp_expr}, created_at = ${timestamp_expr}${completion_where};"

echo
echo "Updated ${chore_count_before} chore row(s)."
echo "Updated ${completion_count_before} completion row(s)."
echo "Done."

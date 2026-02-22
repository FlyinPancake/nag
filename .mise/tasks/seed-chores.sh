#!/usr/bin/env bash
#MISE description="Seed demo chores, tags, and completions"

set -euo pipefail

profile="default"
db_input="${DATABASE_URL:-sqlite://./nag.db}"
reset=false
dry_run=false

usage() {
  cat <<'EOF'
Usage: mise run seed-chores -- [options]

Options:
  --database <DB>              SQLite DB path or URL (default: DATABASE_URL or sqlite://./nag.db)
  --profile <minimal|default|heavy>
                               Seed size/profile (default: default)
  --reset                      Clear chores, completions, tags, and chore_tags before seeding
  --dry-run                    Print what would happen, do not write data
  -h, --help                   Show this help

Examples:
  mise run seed-chores
  mise run seed-chores -- --profile heavy
  mise run seed-chores -- --database sqlite://./nag.db --reset
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --database)
      shift
      db_input="${1:-}"
      ;;
    --profile)
      shift
      profile="${1:-}"
      ;;
    --reset)
      reset=true
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

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "sqlite3 is required but was not found in PATH" >&2
  exit 1
fi

if [[ "$db_input" == "sqlite::memory:" ]]; then
  echo "sqlite::memory: is not supported by this task; use a file-backed database" >&2
  exit 1
fi

case "$profile" in
  minimal|default|heavy) ;;
  *)
    echo "--profile must be one of: minimal, default, heavy" >&2
    exit 1
    ;;
esac

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

sql_file=$(mktemp)
trap 'rm -f "$sql_file"' EXIT

emit_tag() {
  local name="$1"
  local color="$2"
  cat <<EOF
INSERT OR IGNORE INTO tags (id, name, color, created_at)
VALUES (randomblob(16), '$name', '$color', strftime('%Y-%m-%dT%H:%M:%SZ','now'));
EOF
}

emit_chore() {
  local name="$1"
  local description="$2"
  local schedule_type="$3"
  local cron_schedule="$4"
  local interval_days="$5"
  local hour="$6"
  local minute="$7"
  local created_offset="$8"

  cat <<EOF
INSERT INTO chores (
  id, name, description, schedule_type, cron_schedule,
  interval_days, interval_time_hour, interval_time_minute, created_at, updated_at
)
SELECT
  randomblob(16), '$name', '$description', '$schedule_type', ${cron_schedule},
  ${interval_days}, ${hour}, ${minute},
  strftime('%Y-%m-%dT%H:%M:%SZ','now','${created_offset}'),
  strftime('%Y-%m-%dT%H:%M:%SZ','now','${created_offset}')
WHERE NOT EXISTS (SELECT 1 FROM chores WHERE name = '$name');
EOF
}

emit_chore_tag() {
  local chore_name="$1"
  local tag_name="$2"
  cat <<EOF
INSERT OR IGNORE INTO chore_tags (chore_id, tag_id)
SELECT c.id, t.id
FROM chores c, tags t
WHERE c.name = '$chore_name' AND t.name = '$tag_name';
EOF
}

emit_completion_if_none() {
  local chore_name="$1"
  local completed_offset="$2"
  local notes="$3"
  cat <<EOF
INSERT INTO completions (id, chore_id, completed_at, notes, created_at)
SELECT
  randomblob(16),
  c.id,
  strftime('%Y-%m-%dT%H:%M:%SZ','now','${completed_offset}'),
  '$notes',
  strftime('%Y-%m-%dT%H:%M:%SZ','now','${completed_offset}')
FROM chores c
WHERE c.name = '$chore_name'
  AND NOT EXISTS (SELECT 1 FROM completions x WHERE x.chore_id = c.id);
EOF
}

{
  echo "BEGIN;"

  if [[ "$reset" == true ]]; then
    echo "DELETE FROM chore_tags;"
    echo "DELETE FROM completions;"
    echo "DELETE FROM chores;"
    echo "DELETE FROM tags;"
  fi

  emit_tag "cleaning" "blue"
  emit_tag "kitchen" "green"
  emit_tag "bathroom" "teal"
  emit_tag "outdoor" "orange"
  emit_tag "admin" "slate"
  emit_tag "laundry" "violet"

  emit_chore "Vacuum living room" "Whole floor and couch corners" "interval" "NULL" "7" "9" "0" "-12 day"
  emit_chore "Take out trash" "Bins to curb" "interval" "NULL" "2" "7" "30" "-5 day"
  emit_chore "Clean bathroom" "Shower and sink" "interval" "NULL" "10" "18" "0" "-15 day"
  emit_chore "Water plants" "Indoor and patio plants" "cron" "'0 8 * * *'" "NULL" "NULL" "NULL" "-7 day"

  emit_chore_tag "Vacuum living room" "cleaning"
  emit_chore_tag "Take out trash" "outdoor"
  emit_chore_tag "Clean bathroom" "bathroom"
  emit_chore_tag "Water plants" "outdoor"

  emit_completion_if_none "Vacuum living room" "-10 day" "Initial seed completion"
  emit_completion_if_none "Take out trash" "-4 day" "Initial seed completion"

  if [[ "$profile" == "default" || "$profile" == "heavy" ]]; then
    emit_chore "Mop kitchen" "Deep mop after sweeping" "interval" "NULL" "6" "20" "0" "-11 day"
    emit_chore "Pay utility bills" "Electric + water" "cron" "'0 10 1 * *'" "NULL" "NULL" "NULL" "-30 day"
    emit_chore "Change bed sheets" "Main bedroom" "interval" "NULL" "14" "11" "0" "-20 day"
    emit_chore "Inbox zero" "Email and pending admin" "cron" "'0 17 * * 1-5'" "NULL" "NULL" "NULL" "-9 day"

    emit_chore_tag "Mop kitchen" "kitchen"
    emit_chore_tag "Mop kitchen" "cleaning"
    emit_chore_tag "Pay utility bills" "admin"
    emit_chore_tag "Change bed sheets" "laundry"
    emit_chore_tag "Inbox zero" "admin"

    emit_completion_if_none "Mop kitchen" "-9 day" "Initial seed completion"
    emit_completion_if_none "Change bed sheets" "-13 day" "Initial seed completion"
  fi

  if [[ "$profile" == "heavy" ]]; then
    emit_chore "Dust bookshelves" "Living room shelves" "interval" "NULL" "21" "16" "0" "-40 day"
    emit_chore "Wipe fridge shelves" "Quick clean" "interval" "NULL" "30" "12" "0" "-45 day"
    emit_chore "Trim hedges" "Front yard" "cron" "'0 9 * * 6'" "NULL" "NULL" "NULL" "-18 day"
    emit_chore "Backup laptop" "Run backup job" "cron" "'0 22 * * 0'" "NULL" "NULL" "NULL" "-16 day"
    emit_chore "Descale kettle" "Kitchen appliance maintenance" "interval" "NULL" "30" "8" "30" "-35 day"
    emit_chore "Wash towels" "Bathroom towels" "interval" "NULL" "5" "19" "0" "-8 day"

    emit_chore_tag "Dust bookshelves" "cleaning"
    emit_chore_tag "Wipe fridge shelves" "kitchen"
    emit_chore_tag "Trim hedges" "outdoor"
    emit_chore_tag "Backup laptop" "admin"
    emit_chore_tag "Descale kettle" "kitchen"
    emit_chore_tag "Wash towels" "laundry"

    emit_completion_if_none "Dust bookshelves" "-25 day" "Initial seed completion"
    emit_completion_if_none "Wipe fridge shelves" "-31 day" "Initial seed completion"
    emit_completion_if_none "Descale kettle" "-31 day" "Initial seed completion"
    emit_completion_if_none "Wash towels" "-6 day" "Initial seed completion"
  fi

  echo "COMMIT;"
} > "$sql_file"

echo "Database: $db_path"
echo "Profile: $profile"
echo "Reset before seeding: $reset"

if [[ "$dry_run" == true ]]; then
  echo
  echo "[dry-run] SQL to execute:"
  cat "$sql_file"
  exit 0
fi

sqlite3 "$db_path" < "$sql_file"

echo
echo "Seed complete. Current counts:"
echo "- chores: $(sqlite3 "$db_path" "SELECT COUNT(*) FROM chores;")"
echo "- completions: $(sqlite3 "$db_path" "SELECT COUNT(*) FROM completions;")"
echo "- tags: $(sqlite3 "$db_path" "SELECT COUNT(*) FROM tags;")"
echo "- chore_tags: $(sqlite3 "$db_path" "SELECT COUNT(*) FROM chore_tags;")"

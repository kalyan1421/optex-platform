#!/usr/bin/env bash
#
# Apply Backend/supabase/migrations/*.sql to a HOSTED Supabase project, in
# order, exactly once each.
#
# `docker/migrate.sh` is the local-dev equivalent and deliberately stays
# separate: it targets the Docker container by hostname, runs as the container's
# superuser, and tracks state in its own `_docker.migrations` table. Pointing it
# at a hosted database would record migrations somewhere the Supabase dashboard,
# CLI and Management API cannot see.
#
# This one tracks in `supabase_migrations.schema_migrations`, which is the table
# the CLI and dashboard read — so after a run, `supabase migration list` and the
# dashboard agree with reality.
#
# USAGE
#   export SUPABASE_DB_URL='postgresql://postgres:...@db.<ref>.supabase.co:5432/postgres'
#   ./Backend/supabase/migrate-hosted.sh            # apply what is missing
#   ./Backend/supabase/migrate-hosted.sh --dry-run  # show what WOULD apply
#   ./Backend/supabase/migrate-hosted.sh --seed     # also run seed.sql (read the warning)
#
# The connection string is read from the environment and never passed on the
# command line — an argument would land in your shell history and in `ps` output
# for every other user on the machine.

set -euo pipefail

MIGRATIONS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/migrations"
SEED_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/seed.sql"

DRY_RUN=0
RUN_SEED=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --seed)    RUN_SEED=1 ;;
    -h|--help) sed -n '2,28p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown argument: $arg" >&2; exit 2 ;;
  esac
done

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  cat >&2 <<'MSG'
SUPABASE_DB_URL is not set.

  Supabase Dashboard -> Project Settings -> Database -> Connection string -> URI

  export SUPABASE_DB_URL='postgresql://postgres:...@db.<ref>.supabase.co:5432/postgres'

Use the DIRECT connection (port 5432), not the transaction pooler (6543):
the pooler does not support the session-level operations DDL needs, and some
of these migrations create types, functions and policies.
MSG
  exit 1
fi

command -v psql >/dev/null 2>&1 || { echo "psql not found. Install the postgresql client." >&2; exit 1; }

# Fail fast and loudly rather than half-applying. Every file below is wrapped in
# its own transaction, so a failure leaves that migration entirely unapplied
# instead of partially so.
PSQL=(psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 --quiet --no-psqlrc)

echo "Connecting..."
"${PSQL[@]}" -Atc 'select 1' >/dev/null || { echo "Could not connect. Check SUPABASE_DB_URL." >&2; exit 1; }

# The CLI creates this itself, but a project migrated only through the dashboard
# or through raw psql may not have it. `if not exists` on both so this is safe
# either way, and the column list matches what the CLI expects to find.
"${PSQL[@]}" <<'SQL' >/dev/null
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version    text primary key,
  statements text[],
  name       text
);
SQL

applied="$("${PSQL[@]}" -Atc 'select version from supabase_migrations.schema_migrations')"

is_applied() {
  printf '%s\n' "$applied" | grep -Fxq "$1"
}

pending=0
skipped=0
failed=""

for file in "$MIGRATIONS_DIR"/*.sql; do
  base="$(basename "$file")"
  version="${base%%_*}"
  name="${base#*_}"; name="${name%.sql}"

  if is_applied "$version"; then
    skipped=$((skipped + 1))
    continue
  fi

  pending=$((pending + 1))

  if [ "$DRY_RUN" -eq 1 ]; then
    echo "  would apply  $base"
    continue
  fi

  echo "  applying     $base"
  # --single-transaction so a mid-file error rolls the whole file back. Verified
  # there is no CREATE INDEX CONCURRENTLY anywhere in these migrations, which is
  # the one thing that cannot run inside a transaction.
  if ! "${PSQL[@]}" --single-transaction -f "$file"; then
    failed="$base"
    break
  fi

  # Recorded only after the file succeeds, and as its own statement so a failure
  # here cannot mark an unapplied migration as done.
  "${PSQL[@]}" -c \
    "insert into supabase_migrations.schema_migrations (version, name)
     values ('$version', '$name')
     on conflict (version) do nothing" >/dev/null
done

if [ -n "$failed" ]; then
  cat >&2 <<MSG

FAILED on $failed — it was rolled back and NOT recorded.

Everything before it is applied and recorded, so fix the cause and re-run:
this script skips what is already done.
MSG
  exit 1
fi

if [ "$DRY_RUN" -eq 1 ]; then
  echo
  echo "Dry run: $pending would apply, $skipped already applied."
  exit 0
fi

echo
echo "Done: $pending applied, $skipped already present."

if [ "$RUN_SEED" -eq 1 ]; then
  cat <<'WARN'

--- seed.sql ---
This inserts DEMO data, including a super_admin whose password is the literal
string 'admin@123', hardcoded in the file. That is a local-dev fixture. Do not
run it against anything real, and if you already have, change that password
before the project is reachable by anyone else.
WARN
  read -r -p "Type 'seed' to continue: " confirm
  [ "$confirm" = "seed" ] || { echo "Skipped."; exit 0; }
  "${PSQL[@]}" --single-transaction -f "$SEED_FILE"
  echo "Seed applied."
fi

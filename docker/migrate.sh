#!/bin/sh
# Idempotent migration runner for Docker Compose local dev.
# Tracks applied migrations in _docker.migrations so re-runs are safe.
#
# The tracking table lives in its own `_docker` schema, NOT in `public`, because
# `supabase gen types --schema public` would otherwise emit it into
# packages/db/src/database.types.ts as though it were part of the application
# schema — a table that exists only in local Docker and never on hosted Supabase.
set -e

PGHOST="${PGHOST:-supabase-db}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-postgres}"
PGDATABASE="${PGDATABASE:-postgres}"

echo "Waiting for database at $PGHOST:$PGPORT..."
until pg_isready -h "$PGHOST" -p "$PGPORT" -U "$PGUSER"; do
  sleep 2
done
echo "Database ready."

# Create tracking table (idempotent), and carry over any rows from the previous
# location in `public`. The carry-over MUST happen before any migration runs —
# losing the tracking would re-run every file from the top, and the migrations
# are not individually idempotent (plain CREATE TABLE etc.), so they would fail
# on "already exists" and wedge the stack.
#
# Quoted heredoc: the DO block's $$ would otherwise be expanded by the shell.
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -v ON_ERROR_STOP=1 <<'SQL'
CREATE SCHEMA IF NOT EXISTS _docker;
CREATE TABLE IF NOT EXISTS _docker.migrations (
  filename   TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ DEFAULT now()
);
DO $$
BEGIN
  IF to_regclass('public._docker_migrations') IS NOT NULL THEN
    INSERT INTO _docker.migrations (filename, applied_at)
      SELECT filename, applied_at FROM public._docker_migrations
      ON CONFLICT (filename) DO NOTHING;
    DROP TABLE public._docker_migrations;
    RAISE NOTICE 'Moved migration tracking from public._docker_migrations to _docker.migrations';
  END IF;
END
$$;
SQL

# The base postgres image's init scripts create the Supabase service roles
# (supabase_auth_admin, authenticator, supabase_storage_admin) but never assign
# them passwords, so GoTrue/PostgREST/Storage fail to connect. These are
# supautils "reserved roles" — only the true superuser (supabase_admin, not
# postgres) can ALTER them. Set them here, idempotently, to match the shared
# PGPASSWORD used across docker-compose.yml.
echo "Ensuring API role passwords..."
psql -h "$PGHOST" -p "$PGPORT" -U supabase_admin -d "$PGDATABASE" -v ON_ERROR_STOP=1 -c \
  "ALTER ROLE authenticator WITH LOGIN PASSWORD '$PGPASSWORD';
   ALTER ROLE supabase_auth_admin WITH LOGIN PASSWORD '$PGPASSWORD';
   ALTER ROLE supabase_storage_admin WITH LOGIN PASSWORD '$PGPASSWORD';"

run_file() {
  filepath="$1"
  filename=$(basename "$filepath")

  # psql's `:'var'` client-side interpolation isn't applied for -c on this
  # image, so the previous -v-based check always errored and silently fell
  # through to "already applied" without ever running a migration. Escape
  # the filename for safe embedding in a SQL string literal instead (doubling
  # single quotes is the standard SQL-literal escape and is safe here since
  # filenames come from our own repo's migration directory, not user input).
  escaped=$(printf '%s' "$filename" | sed "s/'/''/g")

  count=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -t \
    -c "SELECT COUNT(*) FROM _docker.migrations WHERE filename = '$escaped';" \
    | tr -d ' \n')

  if [ "$count" = "0" ]; then
    echo "  ▸ $filename"
    # --single-transaction wraps the whole file in BEGIN/COMMIT so a failure
    # partway through rolls back cleanly instead of leaving partially-applied
    # DDL committed — without this, a retry re-runs the file from the top and
    # immediately dies on "already exists" for whatever committed before the
    # original failure, permanently wedging the migration until the volume
    # is wiped by hand.
    if psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" \
        --single-transaction -v ON_ERROR_STOP=1 -f "$filepath"; then
      psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" \
        -c "INSERT INTO _docker.migrations (filename) VALUES ('$escaped') ON CONFLICT DO NOTHING;" \
        > /dev/null
    else
      echo "  ✗ $filename failed — aborting"
      exit 1
    fi
  else
    echo "  - $filename (already applied)"
  fi
}

echo "Running migrations..."
for f in $(ls /migrations/*.sql 2>/dev/null | sort); do
  run_file "$f"
done

echo "Running seed..."
run_file /seed.sql

# supabase-rest (PostgREST) caches the DB schema at its own startup and has no
# built-in watch on this hand-rolled stack's migrations -- hosted Supabase and
# the CLI both wire an event trigger that NOTIFYs PostgREST on DDL, but this
# docker-compose stack doesn't. Without this, every table/function created or
# changed by a migration that ran after supabase-rest booted is invisible to
# PostgREST ("Could not find the function/table ... in the schema cache"),
# even though it exists and psql can see it fine. Safe to send unconditionally
# on every run, applied or not.
echo "Reloading PostgREST schema cache..."
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -v ON_ERROR_STOP=1 \
  -c "NOTIFY pgrst, 'reload schema';"

echo "All done."

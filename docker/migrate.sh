#!/bin/sh
# Idempotent migration runner for Docker Compose local dev.
# Tracks applied migrations in _docker_migrations so re-runs are safe.
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

# Create tracking table (idempotent)
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -c \
  "CREATE TABLE IF NOT EXISTS _docker_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT now());"

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
    -c "SELECT COUNT(*) FROM _docker_migrations WHERE filename = '$escaped';" \
    | tr -d ' \n')

  if [ "$count" = "0" ]; then
    echo "  ▸ $filename"
    if psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" \
        -v ON_ERROR_STOP=1 -f "$filepath"; then
      psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" \
        -c "INSERT INTO _docker_migrations (filename) VALUES ('$escaped') ON CONFLICT DO NOTHING;" \
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

echo "All done."

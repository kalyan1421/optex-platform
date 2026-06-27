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

run_file() {
  local filepath="$1"
  local filename
  filename=$(basename "$filepath")

  # C-1 FIX: Use -v to pass filename as a psql variable, preventing SQL injection
  # from specially-crafted filenames containing single quotes or semicolons.
  count=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -t \
    -v "fname=$filename" \
    -c "SELECT COUNT(*) FROM _docker_migrations WHERE filename = :'fname';" \
    | tr -d ' \n')

  if [ "$count" = "0" ]; then
    echo "  ▸ $filename"
    if psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" \
        -v ON_ERROR_STOP=1 -f "$filepath"; then
      psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" \
        -v "fname=$filename" \
        -c "INSERT INTO _docker_migrations (filename) VALUES (:'fname') ON CONFLICT DO NOTHING;" \
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

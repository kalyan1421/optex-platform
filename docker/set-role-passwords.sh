#!/bin/sh
# Give the Supabase service roles the shared local-dev password.
#
# WHY THIS IS A SEPARATE STEP FROM migrate.sh
#
# The cold-start bootstrap is circular, and splitting it here is what breaks
# the cycle:
#
#   • gotrue connects as `supabase_auth_admin`, postgrest as `authenticator`,
#     storage as `supabase_storage_admin`. The supabase/postgres image creates
#     those roles but does not set the password docker-compose.yml uses, so on
#     a fresh volume all three fail SASL auth and the containers die.
#
#   • Migration 0001 references `auth.jwt()`, which does not exist until gotrue
#     has run its own migrations and created the `auth` schema.
#
# So the passwords must be set before gotrue starts, and 0001 must run after.
# When both lived in migrate.sh neither ordering worked: run it early and 0001
# fails on the missing auth.jwt(); run it late and gotrue is already dead.
#
# A warm volume hid all of this — the passwords and the auth schema both
# survive from previous runs, so only the very first `docker compose up` on a
# machine was affected. CI is always a first run, which is where it surfaced.
#
# Idempotent: safe on every boot, including volumes created before this split.
set -eu

echo "Setting API role passwords..."

# Only the true superuser (supabase_admin, not postgres) may ALTER these —
# supautils treats them as reserved roles.
psql -h "$PGHOST" -p "$PGPORT" -U supabase_admin -d "$PGDATABASE" -v ON_ERROR_STOP=1 -c \
  "ALTER ROLE authenticator          WITH LOGIN PASSWORD '$PGPASSWORD';
   ALTER ROLE supabase_auth_admin    WITH LOGIN PASSWORD '$PGPASSWORD';
   ALTER ROLE supabase_storage_admin WITH LOGIN PASSWORD '$PGPASSWORD';"

echo "API role passwords set."

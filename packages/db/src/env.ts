/**
 * Centralised env-var access. Throws at first call if a required key is
 * missing — fail fast with a message that points the dev at .env.local
 * instead of bubbling up Supabase's opaque "URL and Key are required".
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `[@optex/db] Missing required env var: ${name}.\n` +
        `  → Copy apps/web/.env.example or apps/admin/.env.example to .env.local in the same folder, fill in your Supabase project URL + anon key, and restart the dev server.`,
    )
  }
  return value
}

export const supabaseUrl = (): string =>
  required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL)

export const supabaseAnonKey = (): string =>
  required('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

export const supabaseServiceRoleKey = (): string =>
  required('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY)

/** True when the public Supabase env is present. Use to gate optional queries. */
export const isSupabaseConfigured = (): boolean =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

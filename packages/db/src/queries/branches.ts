import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Tables } from '../database.types'

export type Branch = Tables<'branches'>

export async function listBranches(
  db: SupabaseClient<Database>,
): Promise<Branch[]> {
  const { data, error } = await db
    .from('branches')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function getBranchBySlug(
  db: SupabaseClient<Database>,
  slug: string,
): Promise<Branch | null> {
  const { data, error } = await db
    .from('branches')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()
  if (error) throw error
  return data
}

export interface BranchHoursDay {
  open: string
  close: string
}

/**
 * `branches.hours` is a jsonb column of shape:
 *   { mon: ["09:00","18:00"] | null, tue: ..., ..., sun: ... }
 *
 * Returns a Mon→Sun ordered list for display.
 */
export function formatBranchHours(
  hours: Branch['hours'],
): Array<{ day: string; open: string; close: string } | { day: string; closed: true }> {
  const days = [
    ['mon', 'Monday'],
    ['tue', 'Tuesday'],
    ['wed', 'Wednesday'],
    ['thu', 'Thursday'],
    ['fri', 'Friday'],
    ['sat', 'Saturday'],
    ['sun', 'Sunday'],
  ] as const
  const obj = (hours ?? {}) as Record<string, [string, string] | null | undefined>
  return days.map(([key, label]) => {
    const slot = obj[key]
    if (!slot || !Array.isArray(slot)) return { day: label, closed: true as const }
    return { day: label, open: slot[0] ?? '', close: slot[1] ?? '' }
  })
}

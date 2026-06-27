import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Tables } from '../database.types'

export type Appointment = Tables<'appointments'>

export const APPOINTMENT_TYPES = [
  { value: 'eye_test', label: 'Eye test' },
  { value: 'frame_fitting', label: 'Frame fitting' },
  { value: 'consultation', label: 'Consultation' },
] as const

export type AppointmentType = (typeof APPOINTMENT_TYPES)[number]['value']

export interface CreateAppointmentInput {
  branchId: string
  type: AppointmentType
  scheduledAt: Date
  customerId?: string | null
  contactName?: string | null
  contactPhone?: string | null
  notes?: string | null
}

/**
 * Insert an appointment. RLS allows authenticated customers to book for
 * themselves, and also allows anon inserts when customer_id is null
 * (guest bookings — required by the SOW).
 */
export async function createAppointment(
  db: SupabaseClient<Database>,
  input: CreateAppointmentInput,
): Promise<Appointment> {
  const { data, error } = await db
    .from('appointments')
    .insert({
      branch_id: input.branchId,
      type: input.type,
      scheduled_at: input.scheduledAt.toISOString(),
      customer_id: input.customerId ?? null,
      contact_name: input.contactName ?? null,
      contact_phone: input.contactPhone ?? null,
      notes: input.notes ?? null,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export type { Database, Tables, TablesInsert, TablesUpdate, Json, Enums } from './database.types'

import type { Database } from './database.types'

// Enum type aliases derived from the DB schema
export type OrderStatus      = Database['public']['Enums']['order_status']
export type PaymentMethod    = Database['public']['Enums']['payment_method']
export type PaymentStatus    = Database['public']['Enums']['payment_status']
export type AppointmentStatus = Database['public']['Enums']['appt_status']
export type ReviewStatus     = Database['public']['Enums']['review_status']
export type PrescriptionStatus = Database['public']['Enums']['pres_status']
export type DiscountKind     = Database['public']['Enums']['discount_kind']

export { isSupabaseConfigured } from './env'

export * from './queries/products'
export * from './queries/orders'
export * from './queries/auth'
export * from './queries/cart'
export * from './queries/branches'
export * from './queries/appointments'
export * from './queries/admin'

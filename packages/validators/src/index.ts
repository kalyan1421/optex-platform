/**
 * @optex/validators
 *
 * Single source-of-truth Zod schemas for all user-submitted data.
 * Consumed by:
 *   - apps/web  : form validation (react-hook-form zodResolver) + Route Handler body parsing
 *   - apps/admin: filter forms, product CRUD inputs
 *   - packages/db: CreateOrderInput cross-validation
 *
 * Keeping schemas here prevents web and admin from independently drifting
 * toward different validation rules for the same data shapes.
 */

import { z } from 'zod'

// ─── Primitives ──────────────────────────────────────────────────────────────

const phoneKE = z
  .string()
  .regex(/^(\+254|0)[17]\d{8}$/, 'Enter a valid Kenyan phone number (07xx or 01xx)')

const emailSchema = z.string().email('Enter a valid email address').toLowerCase()

// ─── Contact form ─────────────────────────────────────────────────────────────

export const contactFormSchema = z.object({
  name:    z.string().min(2, 'Name must be at least 2 characters').max(100),
  email:   emailSchema,
  phone:   phoneKE.optional().or(z.literal('')),
  subject: z.string().max(200).optional(),
  message: z.string().min(10, 'Message must be at least 10 characters').max(2000),
})

export type ContactFormInput = z.infer<typeof contactFormSchema>

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const signupSchema = z
  .object({
    fullName:        z.string().min(2).max(100),
    email:           emailSchema,
    phone:           phoneKE.optional().or(z.literal('')),
    password:        z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export type SignupInput = z.infer<typeof signupSchema>

export const loginSchema = z.object({
  email:    emailSchema,
  password: z.string().min(1, 'Password is required'),
})

export type LoginInput = z.infer<typeof loginSchema>

// ─── Checkout ────────────────────────────────────────────────────────────────

export const shippingAddressSchema = z.object({
  name:    z.string().min(2).max(100),
  phone:   phoneKE,
  address: z.string().min(5).max(300),
  city:    z.string().min(2).max(100),
  county:  z.string().min(2).max(100),
  postal:  z.string().max(20).optional(),
})

export type ShippingAddress = z.infer<typeof shippingAddressSchema>

export const paymentMethodSchema = z.enum(['mpesa', 'pesapal', 'cod'])

export type PaymentMethod = z.infer<typeof paymentMethodSchema>

export const checkoutSchema = z.object({
  shipping:      shippingAddressSchema,
  paymentMethod: paymentMethodSchema,
  promoCode:     z.string().max(50).optional(),
})

export type CheckoutInput = z.infer<typeof checkoutSchema>

// ─── Appointments ─────────────────────────────────────────────────────────────

export const appointmentSchema = z.object({
  branchId:  z.string().uuid('Invalid branch'),
  type:      z.enum(['eye_test', 'consultation', 'frame_fitting', 'prescription_review', 'other']),
  date:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  time:      z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:MM'),
  name:      z.string().min(2).max(100),
  phone:     phoneKE,
  email:     emailSchema.optional().or(z.literal('')),
  notes:     z.string().max(500).optional(),
})

export type AppointmentInput = z.infer<typeof appointmentSchema>

// ─── Product review ───────────────────────────────────────────────────────────

export const reviewSchema = z.object({
  productId: z.string().uuid(),
  rating:    z.number().int().min(1).max(5),
  title:     z.string().max(150).optional(),
  body:      z.string().min(10, 'Review must be at least 10 characters').max(2000),
})

export type ReviewInput = z.infer<typeof reviewSchema>

// ─── Admin: product CRUD ──────────────────────────────────────────────────────

export const productSchema = z.object({
  name:        z.string().min(2).max(200),
  sku:         z.string().min(2).max(50),
  slug:        z.string().regex(/^[a-z0-9-]+$/, 'Slug must be lowercase with hyphens only'),
  brand:       z.string().min(1).max(100),
  description: z.string().max(5000).optional(),
  price_kes:   z.number().positive('Price must be greater than 0'),
  category_id: z.string().uuid().nullable().optional(),
  is_active:   z.boolean(),
  gender:      z.enum(['men', 'women', 'unisex', 'kids']).optional(),
  frame_shape: z.string().max(50).optional(),
  material:    z.string().max(50).optional(),
  color:       z.string().max(50).optional(),
})

export type ProductInput = z.infer<typeof productSchema>

// ─── Admin: promo code ────────────────────────────────────────────────────────

export const promoCodeSchema = z.object({
  code:       z.string().min(3).max(50).toUpperCase(),
  kind:       z.enum(['percent', 'fixed']),
  value:      z.number().positive(),
  max_uses:   z.number().int().positive().nullable().optional(),
  expires_at: z.string().datetime({ offset: true }).nullable().optional(),
  is_active:  z.boolean(),
})

export type PromoCodeInput = z.infer<typeof promoCodeSchema>

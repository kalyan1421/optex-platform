import type { Tables } from '../database.types';

export type Appointment = Tables<'appointments'>;

export const APPOINTMENT_TYPES = [
  { value: 'eye_test', label: 'Eye test' },
  { value: 'frame_fitting', label: 'Frame fitting' },
  { value: 'consultation', label: 'Consultation' },
] as const;

export type AppointmentType = (typeof APPOINTMENT_TYPES)[number]['value'];

/**
 * Booking is deliberately NOT available here.
 *
 * Appointments must be created through `POST /api/appointments`, which applies
 * `assertSlotBookable()` — branch opening hours for that weekday, slot-grid
 * alignment, and the double-booking guard. The helper that used to live here
 * inserted straight into the table with none of those checks, so the customer
 * booking page could create appointments outside opening hours or on top of an
 * existing one. Use `api.appointments.create()` from `@optex/api-client`.
 */

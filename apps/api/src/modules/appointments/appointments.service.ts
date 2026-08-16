import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { SmsService } from '../notifications/sms.service';
import type { AuthUser } from '../../auth/auth-user';
import type { CreateAppointmentDto } from './dto/create-appointment.dto';
import type { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';
import type { AdminAppointmentQueryDto } from './dto/admin-appointment-query.dto';
import type { UpdateAppointmentDto } from './dto/update-appointment.dto';
import type { SlotsResponseDto } from './dto/slots-response.dto';
import {
  DEFAULT_APPOINTMENT_STATUS,
  type AdminAppointmentDto,
  type AppointmentDto,
  type AppointmentStatus,
  type AppointmentType,
} from './dto/appointment.dto';

/** Columns selected from `appointments`. Mirrors the schema exactly. */
const APPOINTMENT_COLUMNS =
  'id, customer_id, branch_id, type, scheduled_at, status, contact_name, contact_phone, notes, created_at';

/**
 * Admin listing needs the customer and branch NAMES, not just their uuids —
 * otherwise the panel has nothing human-readable to render and has to join
 * client-side against Supabase, which is what gap G-9 was about. Mirrors the
 * approach already used for admin reviews.
 */
const ADMIN_APPOINTMENT_COLUMNS = `${APPOINTMENT_COLUMNS}, customer:customers(full_name, email, phone), branch:branches(name)`;

/**
 * Booking grid resolution, in minutes. Candidate slots are generated on this
 * interval across a branch's open hours for the requested weekday.
 */
const SLOT_MINUTES = 30;

/**
 * Africa/Nairobi has a fixed +03:00 offset year-round (no DST). All wall-clock
 * `date` + `time` inputs are interpreted in this zone, and stored `scheduled_at`
 * (UTC) is read back in this zone to derive the local slot time.
 */
const NAIROBI_OFFSET = '+03:00';
const NAIROBI_OFFSET_MS = 3 * 60 * 60 * 1000;

/** Short weekday keys matching `branches.hours` jsonb keys. Sunday-indexed. */
const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

/**
 * Message raised by the `appointments_enforce_capacity` trigger (0018) when
 * a slot is already at its configured capacity. Matched on message text,
 * not the SQLSTATE alone (the default P0001 for a bare `RAISE EXCEPTION`),
 * since other functions in this schema (`place_order`) also raise plain
 * P0001 exceptions for unrelated reasons.
 */
const SLOT_AT_CAPACITY_MESSAGE = 'appointment_slot_at_capacity';

/**
 * Slim per-weekday window shape shared by `hours` and `breaks` —
 * `{ mon: ["09:00","18:00"], sun: null, ... }`.
 */
type WeekdayWindows = Record<string, [string, string] | null | undefined>;

/**
 * APPOINTMENTS domain logic (basic SOW flow — no doctor concept).
 *
 * The service-role client bypasses RLS, so ownership is enforced here in code:
 * `appointments.customer_id` references `customers.id`, resolved from the
 * caller's `auth_user_id` (JWT `user.id`) before any customer-scoped read or
 * write. Slot times are Africa/Nairobi wall-clock combined with the stored
 * `scheduled_at` timestamptz.
 */
@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly sms: SmsService,
  ) {}

  // ─── Public: availability ──────────────────────────────────────────────────

  /**
   * Returns the free `HH:MM` slot start times for `branchId` on `date`.
   * Candidate slots come from the branch's `hours` for that weekday (sliced on
   * {@link SLOT_MINUTES}); slots already taken by non-cancelled appointments are
   * excluded.
   */
  async getAvailableSlots(branchId: string, date: string): Promise<SlotsResponseDto> {
    const { hours, breaks, capacity } = await this.loadBranchSchedule(branchId);
    const dayKey = WEEKDAY_KEYS[this.weekdayIndex(date)];
    const window = hours?.[dayKey];

    // Closed that day (null or omitted) → no slots.
    if (!window || !Array.isArray(window) || window.length < 2) {
      return { branchId, date, slots: [] };
    }

    const candidates = this.generateSlots(window[0], window[1], breaks?.[dayKey]);
    const taken = await this.takenCounts(branchId, date);
    const slots = candidates.filter((t) => (taken.get(t) ?? 0) < capacity);

    return { branchId, date, slots };
  }

  // ─── Customer: create / read / cancel / reschedule ─────────────────────────

  /**
   * Books an appointment for the caller. Resolves `customer_id`, validates the
   * slot falls within branch hours and is free, inserts with the schema default
   * status (`pending`), then sends a best-effort confirmation SMS.
   */
  async create(user: AuthUser, dto: CreateAppointmentDto): Promise<AppointmentDto> {
    const customerId = await this.resolveCustomerId(user);

    await this.assertSlotBookable(dto.branchId, dto.date, dto.time);

    const scheduledAt = this.toUtcIso(dto.date, dto.time);
    const type: AppointmentType = dto.type ?? 'eye_test';

    const { data, error } = await this.supabase.client
      .from('appointments')
      .insert({
        customer_id: customerId,
        branch_id: dto.branchId,
        type,
        scheduled_at: scheduledAt,
        status: DEFAULT_APPOINTMENT_STATUS,
        notes: dto.notes ?? null,
      })
      .select(APPOINTMENT_COLUMNS)
      .single<AppointmentDto>();

    if (error || !data) {
      // `assertSlotBookable()`'s check is advisory — the `appointments_enforce_capacity`
      // trigger (migration 0018) is what actually stops concurrent requests from
      // together exceeding the branch's configured capacity. A match on this
      // message here means the race the check alone cannot close: same response
      // as the check catching it sequentially.
      if (error?.message?.includes(SLOT_AT_CAPACITY_MESSAGE)) {
        throw new ConflictException('That slot is already booked');
      }
      this.logger.error(`Failed to create appointment: ${error?.message}`);
      throw new InternalServerErrorException('Failed to create appointment');
    }

    await this.sendConfirmationSms(customerId, dto.branchId, dto.date, dto.time);

    return data;
  }

  /** Lists the caller's own bookings, soonest upcoming first by schedule. */
  async listForCustomer(user: AuthUser): Promise<AppointmentDto[]> {
    const customerId = await this.resolveCustomerId(user);

    const { data, error } = await this.supabase.client
      .from('appointments')
      .select(APPOINTMENT_COLUMNS)
      .eq('customer_id', customerId)
      .order('scheduled_at', { ascending: true });

    if (error) {
      this.logger.error(`Failed to list appointments: ${error.message}`);
      throw new InternalServerErrorException('Failed to list appointments');
    }
    return (data ?? []) as AppointmentDto[];
  }

  /**
   * Cancels one of the caller's own bookings (sets status `cancelled`).
   * Idempotent-ish: re-cancelling an already-cancelled booking is a 409.
   */
  async cancelOwn(user: AuthUser, id: string): Promise<AppointmentDto> {
    const customerId = await this.resolveCustomerId(user);
    const existing = await this.findOwned(id, customerId);

    if (existing.status === 'cancelled') {
      throw new ConflictException('Appointment is already cancelled');
    }
    if (existing.status === 'completed') {
      throw new ConflictException('A completed appointment cannot be cancelled');
    }

    return this.applyUpdate(id, { status: 'cancelled' });
  }

  /**
   * Reschedules one of the caller's own bookings to a new slot. Validates the
   * new slot is within branch hours and free, then sets status `rescheduled`.
   */
  async rescheduleOwn(
    user: AuthUser,
    id: string,
    dto: RescheduleAppointmentDto,
  ): Promise<AppointmentDto> {
    const customerId = await this.resolveCustomerId(user);
    const existing = await this.findOwned(id, customerId);

    if (existing.status === 'cancelled' || existing.status === 'completed') {
      throw new ConflictException(`A ${existing.status} appointment cannot be rescheduled`);
    }

    await this.assertSlotBookable(existing.branch_id, dto.date, dto.time, id);

    return this.applyUpdate(id, {
      scheduled_at: this.toUtcIso(dto.date, dto.time),
      status: 'rescheduled',
    });
  }

  // ─── Admin ──────────────────────────────────────────────────────────────────

  /**
   * Lists appointments for the admin panel, with optional filters.
   *
   * R1 1b (branch scoping): a branch-scoped caller (Branch Manager/Staff,
   * `user.branchId` set) always sees only their own branch — `query.branchId`
   * is IGNORED for them rather than merged with it, so a branch-scoped caller
   * cannot widen their own view by passing a different branch in the query
   * string. Non-branch-scoped callers (Super Admin) keep today's behaviour:
   * the client's filter, or every branch when omitted.
   */
  async listForAdmin(
    query: AdminAppointmentQueryDto,
    user: AuthUser,
  ): Promise<AdminAppointmentDto[]> {
    let q = this.supabase.client
      .from('appointments')
      .select(ADMIN_APPOINTMENT_COLUMNS)
      .order('scheduled_at', { ascending: false })
      // F-14: was unbounded. The admin view is date-filtered in practice, but
      // an unfiltered call pulled every booking in the system's history.
      .limit(500);

    const branchFilter = user.branchId ?? query.branchId;
    if (branchFilter) q = q.eq('branch_id', branchFilter);
    if (query.status) q = q.eq('status', query.status);
    if (query.date) {
      // Half-open [startOfDay, startOfNextDay) range in UTC for the local date.
      const start = this.toUtcIso(query.date, '00:00');
      const end = new Date(new Date(start).getTime() + 24 * 60 * 60 * 1000).toISOString();
      q = q.gte('scheduled_at', start).lt('scheduled_at', end);
    }

    const { data, error } = await q;
    if (error) {
      this.logger.error(`Failed to list appointments (admin): ${error.message}`);
      throw new InternalServerErrorException('Failed to list appointments');
    }

    // PostgREST returns an embedded to-one join as either an object or a
    // single-element array depending on how it infers the relationship. Against
    // the current schema both of these resolve to objects, so this is defensive
    // rather than a live fix — but the admin panel reads
    // `row.customer?.full_name`, which is `undefined` on the array shape and
    // would silently render every real booking as "Guest". Adding a second FK
    // to `customers` is enough to flip the inference, so normalise both shapes
    // here, the same way reviews and inventory already do.
    type RawEmbed<T> = T | T[] | null;
    type RawAdminAppointmentRow = Omit<AdminAppointmentDto, 'customer' | 'branch'> & {
      customer: RawEmbed<NonNullable<AdminAppointmentDto['customer']>>;
      branch: RawEmbed<NonNullable<AdminAppointmentDto['branch']>>;
    };

    const unwrap = <T>(embed: RawEmbed<T>): T | null =>
      Array.isArray(embed) ? (embed[0] ?? null) : embed;

    return ((data ?? []) as unknown as RawAdminAppointmentRow[]).map((row) => ({
      ...row,
      customer: unwrap(row.customer),
      branch: unwrap(row.branch),
    }));
  }

  /**
   * Admin update: confirm / cancel / complete (via `status`) and/or reschedule
   * (via `date` + `time`). A date+time without an explicit status is treated as
   * a reschedule (`rescheduled`). The moved slot is re-validated for conflicts.
   */
  async updateForAdmin(id: string, dto: UpdateAppointmentDto): Promise<AppointmentDto> {
    if (dto.status === undefined && dto.date === undefined && dto.time === undefined) {
      throw new BadRequestException('No updatable fields provided');
    }
    if ((dto.date === undefined) !== (dto.time === undefined)) {
      throw new BadRequestException('date and time must be provided together');
    }

    const existing = await this.findById(id);

    const patch: AppointmentUpdate = {};

    if (dto.date !== undefined && dto.time !== undefined) {
      await this.assertSlotBookable(existing.branch_id, dto.date, dto.time, id);
      patch.scheduled_at = this.toUtcIso(dto.date, dto.time);
      // Default the status to `rescheduled` unless the admin set one explicitly.
      patch.status = dto.status ?? 'rescheduled';
    } else if (dto.status !== undefined) {
      patch.status = dto.status;
    }

    return this.applyUpdate(id, patch);
  }

  // ─── Internal helpers ────────────────────────────────────────────────────────

  /**
   * Validates a `date` + `time` is a real slot: within the branch's open hours
   * for that weekday, aligned to the slot grid, and not already taken. Pass
   * `excludeId` when rescheduling so the booking does not conflict with itself.
   */
  private async assertSlotBookable(
    branchId: string,
    date: string,
    time: string,
    excludeId?: string,
  ): Promise<void> {
    const { hours, breaks, capacity } = await this.loadBranchSchedule(branchId);
    const dayKey = WEEKDAY_KEYS[this.weekdayIndex(date)];
    const window = hours?.[dayKey];

    if (!window || !Array.isArray(window) || window.length < 2) {
      throw new BadRequestException('The branch is closed on the requested date');
    }

    const candidates = this.generateSlots(window[0], window[1], breaks?.[dayKey]);
    if (!candidates.includes(time)) {
      throw new BadRequestException('The requested time is not an available slot for this branch');
    }

    const taken = await this.takenCounts(branchId, date, excludeId);
    if ((taken.get(time) ?? 0) >= capacity) {
      throw new ConflictException('That slot is already booked');
    }
  }

  /**
   * Returns non-cancelled booking counts per `HH:MM` slot time for a branch
   * on a date. Optionally excludes one id (rescheduling a booking must not
   * count it against its own former or prospective slot).
   */
  private async takenCounts(
    branchId: string,
    date: string,
    excludeId?: string,
  ): Promise<Map<string, number>> {
    const start = this.toUtcIso(date, '00:00');
    const end = new Date(new Date(start).getTime() + 24 * 60 * 60 * 1000).toISOString();

    let q = this.supabase.client
      .from('appointments')
      .select('id, scheduled_at, status')
      .eq('branch_id', branchId)
      .gte('scheduled_at', start)
      .lt('scheduled_at', end)
      .neq('status', 'cancelled');

    if (excludeId) q = q.neq('id', excludeId);

    const { data, error } = await q;
    if (error) {
      this.logger.error(`Failed to load taken slots: ${error.message}`);
      throw new InternalServerErrorException('Failed to load availability');
    }

    const counts = new Map<string, number>();
    for (const row of (data ?? []) as { scheduled_at: string }[]) {
      const key = this.toNairobiTime(row.scheduled_at);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }

  /** Loads (and validates existence of) a branch's `hours`, `breaks`, and `capacity`. */
  private async loadBranchSchedule(
    branchId: string,
  ): Promise<{ hours: WeekdayWindows | null; breaks: WeekdayWindows | null; capacity: number }> {
    const { data, error } = await this.supabase.client
      .from('branches')
      .select('hours, breaks, capacity')
      .eq('id', branchId)
      .maybeSingle<{
        hours: WeekdayWindows | null;
        breaks: WeekdayWindows | null;
        capacity: number;
      }>();

    if (error) {
      this.logger.error(`Failed to load branch ${branchId}: ${error.message}`);
      throw new InternalServerErrorException('Failed to load branch');
    }
    if (!data) {
      throw new NotFoundException(`Branch ${branchId} not found`);
    }
    return { hours: data.hours ?? null, breaks: data.breaks ?? null, capacity: data.capacity ?? 1 };
  }

  /** Fetches an appointment by id, or 404. */
  private async findById(id: string): Promise<AppointmentDto> {
    const { data, error } = await this.supabase.client
      .from('appointments')
      .select(APPOINTMENT_COLUMNS)
      .eq('id', id)
      .maybeSingle<AppointmentDto>();

    if (error) {
      this.logger.error(`Failed to fetch appointment ${id}: ${error.message}`);
      throw new InternalServerErrorException('Failed to fetch appointment');
    }
    if (!data) {
      throw new NotFoundException('Appointment not found');
    }
    return data;
  }

  /**
   * Fetches an appointment and asserts the caller owns it. A row owned by a
   * different customer is reported as 404 (not 403) to avoid leaking existence;
   * a genuinely missing row is also 404.
   */
  private async findOwned(id: string, customerId: string): Promise<AppointmentDto> {
    const appt = await this.findById(id);
    if (appt.customer_id !== customerId) {
      throw new NotFoundException('Appointment not found');
    }
    return appt;
  }

  /** Applies a patch and returns the updated row, or 404 if it vanished. */
  private async applyUpdate(id: string, patch: AppointmentUpdate): Promise<AppointmentDto> {
    const { data, error } = await this.supabase.client
      .from('appointments')
      .update(patch)
      .eq('id', id)
      .select(APPOINTMENT_COLUMNS)
      .maybeSingle<AppointmentDto>();

    if (error) {
      // Reschedules (customer and admin) both funnel through here, and both
      // race the same way `create()` does — a `scheduled_at` update can
      // collide with other bookings that land after `assertSlotBookable()`
      // last checked. Same guard, same response.
      if (error.message?.includes(SLOT_AT_CAPACITY_MESSAGE)) {
        throw new ConflictException('That slot is already booked');
      }
      this.logger.error(`Failed to update appointment ${id}: ${error.message}`);
      throw new InternalServerErrorException('Failed to update appointment');
    }
    if (!data) {
      throw new NotFoundException('Appointment not found');
    }
    return data;
  }

  /**
   * Resolves the caller's `customers.id` from their `auth_user_id` (JWT
   * subject). Appointments reference `customers.id`, so this hop is required.
   */
  private async resolveCustomerId(user: AuthUser): Promise<string> {
    const { data, error } = await this.supabase.client
      .from('customers')
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle<{ id: string }>();

    if (error) {
      this.logger.error(`Failed to resolve customer: ${error.message}`);
      throw new InternalServerErrorException('Failed to resolve customer');
    }
    if (!data) {
      // The customers row is created on signup; absence means the caller has no
      // profile to attach a booking to.
      throw new ForbiddenException('Customer profile not found');
    }
    return data.id;
  }

  /** Best-effort booking-confirmation SMS to the customer's phone (no-ops safely). */
  private async sendConfirmationSms(
    customerId: string,
    branchId: string,
    date: string,
    time: string,
  ): Promise<void> {
    try {
      const { data } = await this.supabase.client
        .from('customers')
        .select('phone')
        .eq('id', customerId)
        .maybeSingle<{ phone: string | null }>();

      const phone = data?.phone?.trim();
      if (!phone) return;

      await this.sms.sendSms(
        phone,
        `Your Optex Opticians appointment is booked for ${date} at ${time}. We look forward to seeing you.`,
      );
    } catch (err) {
      // Never let a notification failure roll back a successful booking.
      this.logger.warn(`Confirmation SMS skipped: ${(err as Error).message}`);
    }
  }

  // ─── Time helpers (Africa/Nairobi, fixed +03:00) ──────────────────────────────

  /** Day-of-week index (0=Sun..6=Sat) for a YYYY-MM-DD local date. */
  private weekdayIndex(date: string): number {
    // Anchor to local midnight by attaching the Nairobi offset.
    const d = new Date(`${date}T00:00:00${NAIROBI_OFFSET}`);
    if (Number.isNaN(d.getTime())) {
      throw new BadRequestException('Invalid date');
    }
    // getUTCDay on the offset-anchored instant yields the local weekday.
    return new Date(d.getTime() + NAIROBI_OFFSET_MS).getUTCDay();
  }

  /** Combines a local `date` + `time` into a UTC ISO `scheduled_at` value. */
  private toUtcIso(date: string, time: string): string {
    const d = new Date(`${date}T${time}:00${NAIROBI_OFFSET}`);
    if (Number.isNaN(d.getTime())) {
      throw new BadRequestException('Invalid date/time');
    }
    return d.toISOString();
  }

  /** Renders a stored UTC timestamp as the Nairobi-local `HH:MM` slot key. */
  private toNairobiTime(iso: string): string {
    const local = new Date(new Date(iso).getTime() + NAIROBI_OFFSET_MS);
    const hh = String(local.getUTCHours()).padStart(2, '0');
    const mm = String(local.getUTCMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  /**
   * Generates `HH:MM` slot start times from `open` (inclusive) up to but not
   * including `close`, stepping by {@link SLOT_MINUTES}. A slot is dropped
   * when it overlaps `brk` at all — a slot starting exactly at `brk`'s end
   * remains bookable, since `[m, m + SLOT_MINUTES)` no longer intersects
   * `[breakStart, breakEnd)` at that point.
   */
  private generateSlots(open: string, close: string, brk?: [string, string] | null): string[] {
    const start = this.minutesOf(open);
    const end = this.minutesOf(close);
    const breakStart = brk ? this.minutesOf(brk[0]) : null;
    const breakEnd = brk ? this.minutesOf(brk[1]) : null;
    const slots: string[] = [];
    for (let m = start; m + SLOT_MINUTES <= end; m += SLOT_MINUTES) {
      if (
        breakStart !== null &&
        breakEnd !== null &&
        m < breakEnd &&
        m + SLOT_MINUTES > breakStart
      ) {
        continue;
      }
      const hh = String(Math.floor(m / 60)).padStart(2, '0');
      const mm = String(m % 60).padStart(2, '0');
      slots.push(`${hh}:${mm}`);
    }
    return slots;
  }

  /** Minutes-since-midnight for an `HH:MM` string. */
  private minutesOf(hhmm: string): number {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  }
}

/** Subset of writable `appointments` columns used by service-side patches. */
interface AppointmentUpdate {
  scheduled_at?: string;
  status?: AppointmentStatus;
}

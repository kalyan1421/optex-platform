'use client';
import { useEffect, useState } from 'react';
import {
  CalendarCheck,
  Clock,
  MapPin,
  Check,
  RefreshCw,
  X,
  Eye,
  Phone,
  Mail,
  User,
  FileText,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { DatePicker } from '../ui/date-picker';
import { Skeleton } from '../ui/skeleton';
import { api } from '../../lib/api';

type AppointmentStatus = 'Pending' | 'Confirmed' | 'Rescheduled' | 'Cancelled' | 'Completed';
type AppointmentType = 'Eye Test' | 'Frame Fitting' | 'Consultation';

interface Appointment {
  id: string;
  customer: string;
  phone: string;
  /** Account email, when the booking is tied to a registered customer. */
  email: string;
  /** Name/phone typed into the booking form, which may differ from the account. */
  contactName: string;
  contactPhone: string;
  type: AppointmentType;
  branch: string;
  scheduledAt: string; // YYYY-MM-DD local date
  time: string; // HH:MM
  status: AppointmentStatus;
  notes: string;
  /** Whether the booking belongs to a registered customer or a walk-in guest. */
  isGuest: boolean;
  /** When the booking was made, for the detail panel. */
  createdAt: string;
  /** Raw ISO string from DB, used for DB updates */
  scheduled_at_iso: string;
  /** Needed to look up real availability when rescheduling. */
  branchId: string;
}

/**
 * `Pending` was already handled by the filter predicate but was missing from
 * this list, so it was unreachable from the UI even though a summary card
 * counts it.
 */
const FILTERS = ['Today', 'Tomorrow', 'This Week', 'Pending', 'All'];

const STATUS_COLORS: Record<AppointmentStatus, string> = {
  Pending: 'bg-yellow-100 text-yellow-700',
  Confirmed: 'bg-green-100 text-green-700',
  Rescheduled: 'bg-blue-100 text-blue-700',
  Cancelled: 'bg-red-100 text-red-700',
  Completed: 'bg-gray-100 text-gray-600',
};

const TYPE_COLORS: Record<AppointmentType, string> = {
  'Eye Test': 'bg-purple-100 text-purple-700',
  'Frame Fitting': 'bg-cyan-100 text-cyan-700',
  Consultation: 'bg-orange-100 text-orange-700',
};

/**
 * A booking reference a human can read out over the phone.
 *
 * The table used to print the raw UUID, which is 36 characters of noise that
 * nobody can dictate or compare at a glance. The first block of a v4 UUID is
 * enough to pick a row out of a branch's day; the detail dialog still shows
 * the full id for support and for cross-referencing the audit log.
 */
function shortRef(id: string): string {
  return `APT-${id.slice(0, 8).toUpperCase()}`;
}

/** Returns YYYY-MM-DD in local timezone */
function toLocalDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA');
}

/** Normalise DB appointment type string to our union type */
function toAppointmentType(raw: string): AppointmentType {
  const map: Record<string, AppointmentType> = {
    eye_test: 'Eye Test',
    'eye test': 'Eye Test',
    frame_fitting: 'Frame Fitting',
    'frame fitting': 'Frame Fitting',
    consultation: 'Consultation',
  };
  return map[raw.toLowerCase()] ?? (raw as AppointmentType);
}

/** Capitalise first letter for display (pending → Pending) */
function toDisplayStatus(raw: string): AppointmentStatus {
  return (raw.charAt(0).toUpperCase() + raw.slice(1)) as AppointmentStatus;
}

function SkeletonRow() {
  return (
    <tr className="border-b">
      {[...Array(7)].map((_, i) => (
        <td key={i} className="px-3 py-3">
          <Skeleton className="h-4 w-3/4" />
        </td>
      ))}
    </tr>
  );
}

export function Appointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('Today');
  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(null);
  const [detailTarget, setDetailTarget] = useState<Appointment | null>(null);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  /** Validation message from the API when a reschedule is rejected. */
  const [rescheduleError, setRescheduleError] = useState('');
  /** Validation message from the API for confirm / cancel actions. */
  const [actionError, setActionError] = useState('');
  /** Free slots for the reschedule target's branch on the chosen date. */
  const [slotOptions, setSlotOptions] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  // Dynamic today / tomorrow in local timezone
  const TODAY = new Date().toLocaleDateString('en-CA');
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const TOMORROW = tomorrow.toLocaleDateString('en-CA');

  // End of this week (Sunday)
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + (6 - weekEnd.getDay()));
  const WEEK_END = weekEnd.toLocaleDateString('en-CA');

  useEffect(() => {
    // GET /admin/appointments now resolves customer and branch names (G-9),
    // so the panel no longer joins against Supabase to render a row.
    api.admin.appointments
      .list()
      .then((rows) => {
        setAppointments(
          rows.map((row) => {
            const customerName = row.customer?.full_name ?? row.contact_name ?? 'Guest';
            const phone = row.customer?.phone ?? row.contact_phone ?? '—';
            const isoStr = row.scheduled_at ?? '';
            return {
              id: row.id,
              customer: customerName,
              phone,
              email: row.customer?.email ?? '',
              contactName: row.contact_name ?? '',
              contactPhone: row.contact_phone ?? '',
              isGuest: !row.customer_id,
              createdAt: row.created_at ?? '',
              type: toAppointmentType(row.type ?? ''),
              branch: row.branch?.name ?? '—',
              scheduledAt: isoStr ? toLocalDate(isoStr) : '',
              time: isoStr
                ? new Date(isoStr).toLocaleTimeString('en-GB', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '',
              status: toDisplayStatus(row.status ?? 'pending'),
              notes: row.notes ?? '',
              scheduled_at_iso: isoStr,
              branchId: row.branch_id ?? '',
            };
          }),
        );
      })
      .catch((e) => console.error('Failed to fetch appointments:', e))
      .finally(() => setLoading(false));
  }, []);

  /**
   * Load real availability for the reschedule dialog whenever the target
   * appointment or the chosen date changes. The server excludes times already
   * taken and only offers slots inside that branch's opening hours, so the
   * admin can no longer pick a slot the API will reject.
   */
  useEffect(() => {
    if (!rescheduleTarget?.branchId || !newDate) {
      setSlotOptions([]);
      return;
    }

    let cancelled = false;
    setSlotsLoading(true);

    api.appointments
      .slots({ branchId: rescheduleTarget.branchId, date: newDate })
      .then((res) => {
        if (cancelled) return;
        const available = res.slots ?? [];
        setSlotOptions(available);
        setNewTime((current) => (available.includes(current) ? current : ''));
      })
      .catch((e) => {
        if (cancelled) return;
        console.error('slots lookup failed:', e);
        setSlotOptions([]);
        setNewTime('');
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [rescheduleTarget, newDate]);

  function matchesFilter(a: Appointment, f: string): boolean {
    if (f === 'Today') return a.scheduledAt === TODAY;
    if (f === 'Tomorrow') return a.scheduledAt === TOMORROW;
    if (f === 'This Week') return a.scheduledAt >= TODAY && a.scheduledAt <= WEEK_END;
    if (f === 'Pending') return a.status === 'Pending';
    return true;
  }

  const filtered = appointments.filter((a) => matchesFilter(a, filter));

  function confirm(id: string) {
    void (async () => {
      try {
        await api.admin.appointments.update(id, { status: 'confirmed' });
        setAppointments((prev) =>
          prev.map((a) => (a.id === id ? { ...a, status: 'Confirmed' } : a)),
        );
        setActionError('');
      } catch (e) {
        console.error('confirm error:', e);
        setActionError((e as Error)?.message ?? 'Could not confirm the appointment.');
      }
    })();
  }

  function cancel(id: string) {
    void (async () => {
      try {
        await api.admin.appointments.update(id, { status: 'cancelled' });
        setAppointments((prev) =>
          prev.map((a) => (a.id === id ? { ...a, status: 'Cancelled' } : a)),
        );
        setActionError('');
      } catch (e) {
        console.error('cancel error:', e);
        setActionError((e as Error)?.message ?? 'Could not cancel the appointment.');
      }
    })();
  }

  function reschedule() {
    if (!rescheduleTarget || !newDate || !newTime) return;
    const id = rescheduleTarget.id;
    const newIso = new Date(`${newDate}T${newTime}:00`).toISOString();
    void (async () => {
      try {
        // Routing through the API applies assertSlotBookable(): the new slot
        // must fall inside the branch's opening hours for that weekday, land
        // on the slot grid, and be free. The previous direct-to-Supabase write
        // skipped all three, which is how an admin could double-book a slot.
        await api.admin.appointments.update(id, {
          status: 'rescheduled',
          date: newDate,
          time: newTime,
        });
        setAppointments((prev) =>
          prev.map((a) =>
            a.id === id
              ? {
                  ...a,
                  scheduledAt: newDate,
                  time: newTime,
                  status: 'Rescheduled',
                  scheduled_at_iso: newIso,
                }
              : a,
          ),
        );
        setRescheduleTarget(null);
        setNewDate('');
        setNewTime('');
        setRescheduleError('');
      } catch (e) {
        console.error('reschedule error:', e);
        // Keep the dialog open and show the API's reason — "That slot is
        // already booked", "The branch is closed on the requested date", or
        // "The requested time is not an available slot for this branch".
        // These are now real, expected outcomes rather than unexpected errors.
        setRescheduleError(
          (e as Error)?.message ?? 'Could not reschedule to that slot. Please pick another time.',
        );
      }
    })();
  }

  const todayCount = appointments.filter((a) => a.scheduledAt === TODAY).length;
  const pendingCount = appointments.filter((a) => a.status === 'Pending').length;
  const confirmedCount = appointments.filter((a) => a.status === 'Confirmed').length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Appointments</h2>
        <p className="mt-1 text-gray-500">
          Manage eye test, frame fitting, and consultation bookings
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-blue-100 p-2.5">
                <CalendarCheck className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Today</p>
                {loading ? (
                  <Skeleton className="mt-0.5 h-8 w-10" />
                ) : (
                  <p className="text-2xl font-bold">{todayCount}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-yellow-100 p-2.5">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Pending</p>
                {loading ? (
                  <Skeleton className="mt-0.5 h-8 w-10" />
                ) : (
                  <p className="text-2xl font-bold">{pendingCount}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-green-100 p-2.5">
                <Check className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Confirmed</p>
                {loading ? (
                  <Skeleton className="mt-0.5 h-8 w-10" />
                ) : (
                  <p className="text-2xl font-bold">{confirmedCount}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {/* Counts on the tab itself: the list defaults to Today, and with an
            empty count and no other signal an admin reasonably concludes the
            bookings never arrived rather than that they are on another day. */}
        {FILTERS.map((f) => {
          const count = appointments.filter((a) => matchesFilter(a, f)).length;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-[#141776] text-white'
                  : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {f}
              {!loading && (
                <span className={filter === f ? 'ml-1.5 text-white/70' : 'ml-1.5 text-gray-400'}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Appointment List</CardTitle>
          {loading ? (
            <Skeleton className="h-4 w-32" />
          ) : (
            <CardDescription>{`${filtered.length} appointments`}</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">ID</th>
                  <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">
                    Customer
                  </th>
                  <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">Type</th>
                  <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">Branch</th>
                  <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">
                    Date & Time
                  </th>
                  <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">Status</th>
                  <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-10 text-center">
                      <p className="text-sm font-medium text-gray-600">
                        No appointments match &ldquo;{filter}&rdquo;
                      </p>
                      {appointments.length > 0 && filter !== 'All' && (
                        <p className="mt-1 text-sm text-gray-500">
                          {appointments.length} booking{appointments.length === 1 ? '' : 's'} on
                          other dates.{' '}
                          <button
                            type="button"
                            onClick={() => setFilter('All')}
                            className="font-medium text-[#141776] hover:underline"
                          >
                            View all
                          </button>
                        </p>
                      )}
                      {appointments.length === 0 && (
                        <p className="mt-1 text-sm text-gray-500">
                          Bookings made in the storefront appear here.
                        </p>
                      )}
                    </td>
                  </tr>
                ) : (
                  filtered.map((apt) => (
                    <tr key={apt.id} className="border-b hover:bg-gray-50">
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => setDetailTarget(apt)}
                          title={apt.id}
                          className="font-mono text-sm font-medium text-[#141776] hover:underline"
                        >
                          {shortRef(apt.id)}
                        </button>
                      </td>
                      <td className="px-3 py-3">
                        <p className="text-sm font-medium">
                          {apt.customer}
                          {apt.isGuest && (
                            <span className="ml-1.5 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                              Guest
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500">{apt.phone}</p>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[apt.type] ?? 'bg-gray-100 text-gray-600'}`}
                        >
                          {apt.type}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1 text-sm">
                          <MapPin className="h-3.5 w-3.5 text-gray-400" />
                          {apt.branch}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-sm">
                        <p>{apt.scheduledAt}</p>
                        <p className="text-gray-500">{apt.time}</p>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[apt.status]}`}
                        >
                          {apt.status}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDetailTarget(apt)}
                            title="View details"
                            className="h-7 px-2 text-xs"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {apt.status === 'Pending' && (
                            <Button
                              size="sm"
                              onClick={() => confirm(apt.id)}
                              className="h-7 bg-green-600 px-2 text-xs hover:bg-green-700"
                            >
                              <Check className="mr-1 h-3 w-3" />
                              Confirm
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setRescheduleTarget(apt)}
                            className="h-7 px-2 text-xs"
                          >
                            <RefreshCw className="mr-1 h-3 w-3" />
                            Reschedule
                          </Button>
                          {apt.status !== 'Cancelled' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => cancel(apt.id)}
                              className="h-7 px-2 text-xs text-red-500 hover:text-red-700"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {actionError && (
            <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {actionError}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Detail dialog — the full booking, including the fields the table has
          no room for (email, the contact typed on the form, notes, the full
          UUID for support and audit-log cross-referencing). */}
      <Dialog open={!!detailTarget} onOpenChange={() => setDetailTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Appointment Details</DialogTitle>
            <DialogDescription>{detailTarget ? shortRef(detailTarget.id) : ''}</DialogDescription>
          </DialogHeader>
          {detailTarget && (
            <div className="space-y-5 py-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[detailTarget.status]}`}
                >
                  {detailTarget.status}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[detailTarget.type] ?? 'bg-gray-100 text-gray-600'}`}
                >
                  {detailTarget.type}
                </span>
                {detailTarget.isGuest && (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                    Guest booking
                  </span>
                )}
              </div>

              <section className="space-y-2.5">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Customer
                </h4>
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 shrink-0 text-gray-400" />
                  <span className="font-medium">{detailTarget.customer}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 shrink-0 text-gray-400" />
                  {detailTarget.phone && detailTarget.phone !== '—' ? (
                    <a
                      href={`tel:${detailTarget.phone}`}
                      className="text-[#141776] hover:underline"
                    >
                      {detailTarget.phone}
                    </a>
                  ) : (
                    <span className="text-gray-500">No phone on file</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 shrink-0 text-gray-400" />
                  {detailTarget.email ? (
                    <a
                      href={`mailto:${detailTarget.email}`}
                      className="text-[#141776] hover:underline"
                    >
                      {detailTarget.email}
                    </a>
                  ) : (
                    <span className="text-gray-500">No email on file</span>
                  )}
                </div>
                {/* Only worth showing when it differs from the account — otherwise
                    it is the same name and phone twice. */}
                {detailTarget.contactName && detailTarget.contactName !== detailTarget.customer && (
                  <p className="text-sm text-gray-500">
                    Booked as {detailTarget.contactName}
                    {detailTarget.contactPhone ? ` · ${detailTarget.contactPhone}` : ''}
                  </p>
                )}
              </section>

              <section className="space-y-2.5">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Booking
                </h4>
                <div className="flex items-center gap-2 text-sm">
                  <CalendarCheck className="h-4 w-4 shrink-0 text-gray-400" />
                  <span>
                    {detailTarget.scheduledAt} at {detailTarget.time}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 shrink-0 text-gray-400" />
                  <span>{detailTarget.branch}</span>
                </div>
                {detailTarget.createdAt && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 shrink-0 text-gray-400" />
                    <span className="text-gray-500">
                      Booked {new Date(detailTarget.createdAt).toLocaleString('en-GB')}
                    </span>
                  </div>
                )}
              </section>

              <section className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Notes
                </h4>
                <div className="flex gap-2 text-sm">
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                  {detailTarget.notes ? (
                    <p className="whitespace-pre-wrap">{detailTarget.notes}</p>
                  ) : (
                    <p className="text-gray-500">No notes</p>
                  )}
                </div>
              </section>

              <section className="space-y-1 border-t pt-4">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Reference
                </h4>
                <p className="break-all font-mono text-xs text-gray-500">{detailTarget.id}</p>
              </section>

              <div className="flex justify-end gap-2 pt-1">
                {detailTarget.status === 'Pending' && (
                  <Button
                    onClick={() => {
                      confirm(detailTarget.id);
                      setDetailTarget(null);
                    }}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Check className="mr-1 h-4 w-4" />
                    Confirm
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => {
                    setRescheduleTarget(detailTarget);
                    setDetailTarget(null);
                  }}
                >
                  <RefreshCw className="mr-1 h-4 w-4" />
                  Reschedule
                </Button>
                <Button variant="ghost" onClick={() => setDetailTarget(null)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reschedule dialog */}
      <Dialog
        open={!!rescheduleTarget}
        onOpenChange={() => {
          setRescheduleTarget(null);
          setNewDate('');
          setNewTime('');
          setSlotOptions([]);
          setRescheduleError('');
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reschedule Appointment</DialogTitle>
            <DialogDescription>
              {rescheduleTarget ? shortRef(rescheduleTarget.id) : ''} — {rescheduleTarget?.customer}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>New Date</Label>
              <DatePicker value={newDate} onChange={setNewDate} disablePast />
            </div>
            <div className="space-y-1.5">
              <Label>New Time</Label>
              {/*
                Real availability for this branch and date, from the API. The
                previous hardcoded 09:00–16:00 list ignored the branch's actual
                opening hours and offered slots that were already booked.
              */}
              <Select
                value={newTime}
                onValueChange={setNewTime}
                disabled={!newDate || slotsLoading || slotOptions.length === 0}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      !newDate
                        ? 'Pick a date first'
                        : slotsLoading
                          ? 'Loading available times…'
                          : slotOptions.length === 0
                            ? 'No times available'
                            : 'Select time slot'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {slotOptions.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {newDate && !slotsLoading && slotOptions.length === 0 && (
                <p className="text-muted-foreground text-xs">
                  This branch is closed or fully booked on that date.
                </p>
              )}
            </div>
            {rescheduleError && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {rescheduleError}
              </p>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setRescheduleTarget(null)}>
                Cancel
              </Button>
              <Button
                onClick={reschedule}
                className="bg-[#141776] hover:bg-[#0f1258]"
                disabled={!newDate || !newTime}
              >
                Confirm Reschedule
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

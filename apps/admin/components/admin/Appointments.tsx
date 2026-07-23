'use client'
import { useEffect, useState } from 'react';
import { CalendarCheck, Clock, MapPin, Check, RefreshCw, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { DatePicker } from '../ui/date-picker';
import { Skeleton } from '../ui/skeleton';
import { createBrowserSupabase } from '@optex/db/browser';

type AppointmentStatus = 'Pending' | 'Confirmed' | 'Rescheduled' | 'Cancelled' | 'Completed';
type AppointmentType = 'Eye Test' | 'Frame Fitting' | 'Consultation';

interface Appointment {
  id: string;
  customer: string;
  phone: string;
  type: AppointmentType;
  branch: string;
  scheduledAt: string;   // YYYY-MM-DD local date
  time: string;          // HH:MM
  status: AppointmentStatus;
  notes: string;
  /** Raw ISO string from DB, used for DB updates */
  scheduled_at_iso: string;
}

const FILTERS = ['Today', 'Tomorrow', 'This Week', 'All'];

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
  'Consultation': 'bg-orange-100 text-orange-700',
};

/** Returns YYYY-MM-DD in local timezone */
function toLocalDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA');
}

/** Normalise DB appointment type string to our union type */
function toAppointmentType(raw: string): AppointmentType {
  const map: Record<string, AppointmentType> = {
    'eye_test': 'Eye Test',
    'eye test': 'Eye Test',
    'frame_fitting': 'Frame Fitting',
    'frame fitting': 'Frame Fitting',
    'consultation': 'Consultation',
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
        <td key={i} className="py-3 px-3">
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
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');

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
    const db = createBrowserSupabase();
    void (async () => {
      try {
        const { data, error } = await db
          .from('appointments')
          .select('id, type, scheduled_at, status, notes, contact_name, contact_phone, customer:customers(full_name, phone), branch:branches(name)')
          .order('scheduled_at', { ascending: true });

        if (error) {
          console.error('Failed to fetch appointments:', error);
          return;
        }

        const mapped: Appointment[] = (data ?? []).map((row) => {
          // customer may be null for guest bookings
          const customerObj = row.customer as { full_name: string; phone: string } | null;
          const customerName = customerObj?.full_name ?? row.contact_name ?? 'Guest';
          const phone = customerObj?.phone ?? row.contact_phone ?? '—';
          const branchObj = row.branch as { name: string } | null;

          const isoStr: string = row.scheduled_at ?? '';
          const localDate = isoStr ? toLocalDate(isoStr) : '';
          const timeStr = isoStr
            ? new Date(isoStr).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
            : '';

          return {
            id: row.id as string,
            customer: customerName,
            phone,
            type: toAppointmentType(row.type ?? ''),
            branch: branchObj?.name ?? '—',
            scheduledAt: localDate,
            time: timeStr,
            status: toDisplayStatus(row.status ?? 'pending'),
            notes: row.notes ?? '',
            scheduled_at_iso: isoStr,
          };
        });

        setAppointments(mapped);
      } catch (e) {
        console.error('Unexpected error fetching appointments:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = appointments.filter(a => {
    if (filter === 'Today') return a.scheduledAt === TODAY;
    if (filter === 'Tomorrow') return a.scheduledAt === TOMORROW;
    if (filter === 'This Week') return a.scheduledAt >= TODAY && a.scheduledAt <= WEEK_END;
    if (filter === 'Pending') return a.status === 'Pending';
    return true;
  });

  function confirm(id: string) {
    const db = createBrowserSupabase();
    void (async () => {
      try {
        const { error } = await db
          .from('appointments')
          .update({ status: 'confirmed' })
          .eq('id', id);
        if (error) { console.error('confirm error:', error); return; }
        setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: 'Confirmed' } : a));
      } catch (e) {
        console.error('Unexpected error confirming appointment:', e);
      }
    })();
  }

  function cancel(id: string) {
    const db = createBrowserSupabase();
    void (async () => {
      try {
        const { error } = await db
          .from('appointments')
          .update({ status: 'cancelled' })
          .eq('id', id);
        if (error) { console.error('cancel error:', error); return; }
        setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: 'Cancelled' } : a));
      } catch (e) {
        console.error('Unexpected error cancelling appointment:', e);
      }
    })();
  }

  function reschedule() {
    if (!rescheduleTarget || !newDate || !newTime) return;
    const id = rescheduleTarget.id;
    // Build an ISO string from the new local date + time
    const newIso = new Date(`${newDate}T${newTime}:00`).toISOString();
    const db = createBrowserSupabase();
    void (async () => {
      try {
        const { error } = await db
          .from('appointments')
          .update({ status: 'rescheduled', scheduled_at: newIso })
          .eq('id', id);
        if (error) { console.error('reschedule error:', error); return; }
        setAppointments(prev => prev.map(a =>
          a.id === id
            ? { ...a, scheduledAt: newDate, time: newTime, status: 'Rescheduled', scheduled_at_iso: newIso }
            : a
        ));
        setRescheduleTarget(null);
        setNewDate('');
        setNewTime('');
      } catch (e) {
        console.error('Unexpected error rescheduling appointment:', e);
      }
    })();
  }

  const todayCount = appointments.filter(a => a.scheduledAt === TODAY).length;
  const pendingCount = appointments.filter(a => a.status === 'Pending').length;
  const confirmedCount = appointments.filter(a => a.status === 'Confirmed').length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-bold text-2xl text-gray-900">Appointments</h2>
        <p className="text-gray-500 mt-1">Manage eye test, frame fitting, and consultation bookings</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 p-2.5 rounded-full"><CalendarCheck className="w-5 h-5 text-blue-600" /></div>
              <div>
                <p className="text-sm text-gray-500">Today</p>
                {loading
                  ? <Skeleton className="h-8 w-10 mt-0.5" />
                  : <p className="font-bold text-2xl">{todayCount}</p>
                }
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="bg-yellow-100 p-2.5 rounded-full"><Clock className="w-5 h-5 text-yellow-600" /></div>
              <div>
                <p className="text-sm text-gray-500">Pending</p>
                {loading
                  ? <Skeleton className="h-8 w-10 mt-0.5" />
                  : <p className="font-bold text-2xl">{pendingCount}</p>
                }
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="bg-green-100 p-2.5 rounded-full"><Check className="w-5 h-5 text-green-600" /></div>
              <div>
                <p className="text-sm text-gray-500">Confirmed</p>
                {loading
                  ? <Skeleton className="h-8 w-10 mt-0.5" />
                  : <p className="font-bold text-2xl">{confirmedCount}</p>
                }
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === f ? 'bg-[#141776] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {f}
          </button>
        ))}
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
                  <th className="text-left py-3 px-3 text-sm font-medium text-gray-700">ID</th>
                  <th className="text-left py-3 px-3 text-sm font-medium text-gray-700">Customer</th>
                  <th className="text-left py-3 px-3 text-sm font-medium text-gray-700">Type</th>
                  <th className="text-left py-3 px-3 text-sm font-medium text-gray-700">Branch</th>
                  <th className="text-left py-3 px-3 text-sm font-medium text-gray-700">Date & Time</th>
                  <th className="text-left py-3 px-3 text-sm font-medium text-gray-700">Status</th>
                  <th className="text-left py-3 px-3 text-sm font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
                  : filtered.map(apt => (
                    <tr key={apt.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-3 font-medium text-[#141776] text-sm">{apt.id}</td>
                      <td className="py-3 px-3">
                        <p className="font-medium text-sm">{apt.customer}</p>
                        <p className="text-xs text-gray-500">{apt.phone}</p>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[apt.type] ?? 'bg-gray-100 text-gray-600'}`}>
                          {apt.type}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1 text-sm">
                          <MapPin className="w-3.5 h-3.5 text-gray-400" />
                          {apt.branch}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-sm">
                        <p>{apt.scheduledAt}</p>
                        <p className="text-gray-500">{apt.time}</p>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[apt.status]}`}>
                          {apt.status}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1">
                          {apt.status === 'Pending' && (
                            <Button size="sm" onClick={() => confirm(apt.id)} className="h-7 px-2 text-xs bg-green-600 hover:bg-green-700">
                              <Check className="w-3 h-3 mr-1" />Confirm
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => setRescheduleTarget(apt)} className="h-7 px-2 text-xs">
                            <RefreshCw className="w-3 h-3 mr-1" />Reschedule
                          </Button>
                          {apt.status !== 'Cancelled' && (
                            <Button size="sm" variant="ghost" onClick={() => cancel(apt.id)} className="h-7 px-2 text-xs text-red-500 hover:text-red-700">
                              <X className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Reschedule dialog */}
      <Dialog open={!!rescheduleTarget} onOpenChange={() => setRescheduleTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reschedule Appointment</DialogTitle>
            <DialogDescription>{rescheduleTarget?.id} — {rescheduleTarget?.customer}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>New Date</Label>
              <DatePicker value={newDate} onChange={setNewDate} disablePast />
            </div>
            <div className="space-y-1.5">
              <Label>New Time</Label>
              <Select value={newTime} onValueChange={setNewTime}>
                <SelectTrigger><SelectValue placeholder="Select time slot" /></SelectTrigger>
                <SelectContent>
                  {['09:00','09:30','10:00','10:30','11:00','11:30','12:00','13:00','13:30','14:00','14:30','15:00','15:30','16:00'].map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setRescheduleTarget(null)}>Cancel</Button>
              <Button onClick={reschedule} className="bg-[#141776] hover:bg-[#0f1258]" disabled={!newDate || !newTime}>
                Confirm Reschedule
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

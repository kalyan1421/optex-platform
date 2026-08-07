'use client';
import { useState, useEffect } from 'react';
import { MapPin, Phone, Clock, Edit, Check } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Skeleton } from '../ui/skeleton';
import { createBrowserSupabase } from '@optex/db/browser';
import { api } from '../../lib/api';

interface Branch {
  id: string;
  name: string;
  address: string;
  phone: string;
  hoursWeekday: string;
  hoursSaturday: string;
  hoursSunday: string;
  lat: string;
  lng: string;
  mapEmbedUrl: string;
}

/** Weekday keys of `branches.hours`, in the order the slot engine expects. */
const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri'] as const;

/** Accepts `["09:00","18:00"]` and renders it as `09:00 - 18:00`. */
function rangeToText(range: unknown): string {
  if (!Array.isArray(range) || range.length < 2) return 'Closed';
  return `${range[0]} - ${range[1]}`;
}

/**
 * Parse `09:00 - 18:00` back into `["09:00","18:00"]`. Anything that is not a
 * valid 24h range — including the literal "Closed" — becomes `null`, which is
 * how the schema represents a closed day.
 */
function textToRange(text: string): [string, string] | null {
  const match = text.trim().match(/^([01]\d|2[0-3]):([0-5]\d)\s*[-–]\s*([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) return null;
  return [`${match[1]}:${match[2]}`, `${match[3]}:${match[4]}`];
}

function mapDbRowToBranch(branch: Record<string, unknown>): Branch {
  // `branches.hours` is keyed by short weekday with `[open, close]` arrays —
  // `{ mon: ["09:00","18:00"], sun: null }`. This component previously read
  // `hours.weekday` / `.saturday` / `.sunday`, which never exist in real data,
  // so it displayed placeholders and then wrote that invented shape back,
  // destroying the per-weekday structure the appointment slot engine reads.
  const hours = (branch.hours ?? {}) as Record<string, unknown>;
  const hoursWeekday = rangeToText(hours.mon);
  const hoursSaturday = rangeToText(hours.sat);
  const hoursSunday = rangeToText(hours.sun);

  const lat = String(branch.lat ?? '');
  const lng = String(branch.lng ?? '');
  const mapEmbedUrl =
    branch.lat && branch.lng
      ? `https://maps.google.com/maps?q=${branch.lat},${branch.lng}&output=embed`
      : '';

  return {
    id: branch.id as string,
    name: (branch.name as string) ?? '',
    address: (branch.address as string) ?? '',
    phone: (branch.phone as string) ?? '',
    hoursWeekday,
    hoursSaturday,
    hoursSunday,
    lat,
    lng,
    mapEmbedUrl,
  };
}

function EditBranchDialog({
  branch,
  open,
  onOpenChange,
  onSave,
}: {
  branch: Branch;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (updated: Branch) => void;
}) {
  const [draft, setDraft] = useState({ ...branch });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Branch — {branch.name}</DialogTitle>
          <DialogDescription>Update address, phone, hours, and coordinates</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Branch Name</Label>
            <Input
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Address</Label>
            <Input
              value={draft.address}
              onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input
              value={draft.phone}
              onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Opening Hours</Label>
            <div className="grid gap-2">
              <div className="grid grid-cols-3 items-center gap-2">
                <span className="col-span-1 text-sm text-gray-500">Mon – Fri</span>
                <Input
                  className="col-span-2"
                  value={draft.hoursWeekday}
                  onChange={(e) => setDraft((d) => ({ ...d, hoursWeekday: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-3 items-center gap-2">
                <span className="col-span-1 text-sm text-gray-500">Saturday</span>
                <Input
                  className="col-span-2"
                  value={draft.hoursSaturday}
                  onChange={(e) => setDraft((d) => ({ ...d, hoursSaturday: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-3 items-center gap-2">
                <span className="col-span-1 text-sm text-gray-500">Sunday</span>
                <Input
                  className="col-span-2"
                  value={draft.hoursSunday}
                  onChange={(e) => setDraft((d) => ({ ...d, hoursSunday: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Latitude</Label>
              <Input
                value={draft.lat}
                onChange={(e) => setDraft((d) => ({ ...d, lat: e.target.value }))}
                placeholder="-1.2833"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Longitude</Label>
              <Input
                value={draft.lng}
                onChange={(e) => setDraft((d) => ({ ...d, lng: e.target.value }))}
                placeholder="36.8172"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                onSave(draft);
                onOpenChange(false);
              }}
              className="bg-[#141776] hover:bg-[#0f1258]"
            >
              <Check className="mr-2 h-4 w-4" />
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BranchCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <Skeleton className="h-48 rounded-none" />
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-8 w-16" />
        </div>
        <div className="space-y-2.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-full" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function Branches() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState<Branch | null>(null);
  /** Validation message from the API when a branch update is rejected. */
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    const db = createBrowserSupabase();
    void (async () => {
      try {
        const { data, error } = await db
          .from('branches')
          .select('id, slug, name, address, phone, lat, lng, hours, is_active')
          .order('created_at');
        if (error) throw error;
        setBranches((data ?? []).map((row) => mapDbRowToBranch(row as Record<string, unknown>)));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function saveBranch(updated: Branch) {
    const previous = branches;
    // Optimistically update local state, then roll back if the API rejects.
    setBranches((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));

    void (async () => {
      try {
        const weekday = textToRange(updated.hoursWeekday);
        const lat = parseFloat(updated.lat);
        const lng = parseFloat(updated.lng);

        // Mon–Fri share one range (the client confirmed all 27 branches follow
        // the same pattern); Saturday and Sunday are set independently.
        const hours: Record<string, [string, string] | null> = {
          sat: textToRange(updated.hoursSaturday),
          sun: textToRange(updated.hoursSunday),
        };
        for (const day of WEEKDAY_KEYS) hours[day] = weekday;

        await api.admin.branches.update(updated.id, {
          name: updated.name,
          address: updated.address,
          phone: updated.phone,
          ...(Number.isFinite(lat) ? { lat } : {}),
          ...(Number.isFinite(lng) ? { lng } : {}),
          hours,
        });
        setSaveError('');
      } catch (e) {
        console.error('branch update failed:', e);
        setBranches(previous);
        setSaveError(
          (e as Error)?.message ??
            'Could not save the branch. Hours must look like "09:00 - 18:00", or "Closed".',
        );
      }
    })();
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Branch Management</h2>
        <p className="mt-1 text-gray-500">Manage store locations, hours, and contact information</p>
      </div>

      {saveError && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{saveError}</p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => <BranchCardSkeleton key={i} />)
          : branches.map((branch) => (
              <Card key={branch.id} className="overflow-hidden">
                <div className="relative h-48 bg-gray-100">
                  {branch.mapEmbedUrl ? (
                    <iframe
                      src={branch.mapEmbedUrl}
                      className="h-full w-full border-0"
                      allowFullScreen={false}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      title={`Map for ${branch.name}`}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">
                      No map coordinates
                    </div>
                  )}
                </div>
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-gray-900">{branch.name}</h3>
                      <span className="mt-1 inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        Open
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditTarget(branch)}
                      className="h-8 px-3"
                    >
                      <Edit className="mr-1.5 h-3.5 w-3.5" />
                      Edit
                    </Button>
                  </div>

                  <div className="space-y-2.5 text-sm">
                    <div className="flex items-start gap-2.5 text-gray-600">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#141776]" />
                      <span>{branch.address}</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-gray-600">
                      <Phone className="h-4 w-4 shrink-0 text-[#141776]" />
                      <span>{branch.phone}</span>
                    </div>
                    <div className="flex items-start gap-2.5 text-gray-600">
                      <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[#141776]" />
                      <div>
                        <p>Mon – Fri: {branch.hoursWeekday}</p>
                        <p>Sat: {branch.hoursSaturday}</p>
                        <p>Sun: {branch.hoursSunday}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 border-t pt-2 text-xs text-gray-400">
                    <span>Lat: {branch.lat}</span>
                    <span>·</span>
                    <span>Lng: {branch.lng}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
      </div>

      {editTarget && (
        <EditBranchDialog
          branch={editTarget}
          open={!!editTarget}
          onOpenChange={(v) => !v && setEditTarget(null)}
          onSave={saveBranch}
        />
      )}
    </div>
  );
}

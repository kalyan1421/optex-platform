'use client'
import { useState, useEffect } from 'react';
import { MapPin, Phone, Clock, Edit, Check } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { createBrowserSupabase } from '@optex/db/browser';

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

function mapDbRowToBranch(branch: Record<string, unknown>): Branch {
  const hours = (branch.hours ?? {}) as Record<string, string>;
  const hoursWeekday = hours.weekday ?? hours['mon-fri'] ?? '—';
  const hoursSaturday = hours.saturday ?? hours.sat ?? '—';
  const hoursSunday = hours.sunday ?? hours.sun ?? 'Closed';

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

function EditBranchDialog({ branch, open, onOpenChange, onSave }: {
  branch: Branch;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (updated: Branch) => void;
}) {
  const [draft, setDraft] = useState({ ...branch });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Branch — {branch.name}</DialogTitle>
          <DialogDescription>Update address, phone, hours, and coordinates</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Branch Name</Label>
            <Input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Address</Label>
            <Input value={draft.address} onChange={e => setDraft(d => ({ ...d, address: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input value={draft.phone} onChange={e => setDraft(d => ({ ...d, phone: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Opening Hours</Label>
            <div className="grid gap-2">
              <div className="grid grid-cols-3 gap-2 items-center">
                <span className="text-sm text-gray-500 col-span-1">Mon – Fri</span>
                <Input className="col-span-2" value={draft.hoursWeekday} onChange={e => setDraft(d => ({ ...d, hoursWeekday: e.target.value }))} />
              </div>
              <div className="grid grid-cols-3 gap-2 items-center">
                <span className="text-sm text-gray-500 col-span-1">Saturday</span>
                <Input className="col-span-2" value={draft.hoursSaturday} onChange={e => setDraft(d => ({ ...d, hoursSaturday: e.target.value }))} />
              </div>
              <div className="grid grid-cols-3 gap-2 items-center">
                <span className="text-sm text-gray-500 col-span-1">Sunday</span>
                <Input className="col-span-2" value={draft.hoursSunday} onChange={e => setDraft(d => ({ ...d, hoursSunday: e.target.value }))} />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Latitude</Label>
              <Input value={draft.lat} onChange={e => setDraft(d => ({ ...d, lat: e.target.value }))} placeholder="-1.2833" />
            </div>
            <div className="space-y-1.5">
              <Label>Longitude</Label>
              <Input value={draft.lng} onChange={e => setDraft(d => ({ ...d, lng: e.target.value }))} placeholder="36.8172" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={() => { onSave(draft); onOpenChange(false); }} className="bg-[#141776] hover:bg-[#0f1258]">
              <Check className="w-4 h-4 mr-2" />Save Changes
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
      <div className="h-48 bg-gray-200 animate-pulse" />
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded animate-pulse w-32" />
            <div className="h-3 bg-gray-100 rounded animate-pulse w-16" />
          </div>
          <div className="h-8 bg-gray-200 rounded animate-pulse w-16" />
        </div>
        <div className="space-y-2.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-3 bg-gray-100 rounded animate-pulse w-full" />
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

  useEffect(() => {
    const db = createBrowserSupabase();
    void (async () => {
      try {
        const { data, error } = await db
          .from('branches')
          .select('id, slug, name, address, phone, lat, lng, hours, is_active')
          .order('created_at');
        if (error) throw error;
        setBranches((data ?? []).map(row => mapDbRowToBranch(row as Record<string, unknown>)));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function saveBranch(updated: Branch) {
    // Optimistically update local state
    setBranches(prev => prev.map(b => b.id === updated.id ? updated : b));

    const db = createBrowserSupabase();
    void (async () => {
      try {
        await db
          .from('branches')
          .update({
            name: updated.name,
            address: updated.address,
            phone: updated.phone,
            lat: parseFloat(updated.lat) || null,
            lng: parseFloat(updated.lng) || null,
            hours: {
              weekday: updated.hoursWeekday,
              saturday: updated.hoursSaturday,
              sunday: updated.hoursSunday,
            },
          })
          .eq('id', updated.id);
      } catch (e) {
        console.error(e);
      }
    })();
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-bold text-2xl text-gray-900">Branch Management</h2>
        <p className="text-gray-500 mt-1">Manage store locations, hours, and contact information</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => <BranchCardSkeleton key={i} />)
          : branches.map(branch => (
              <Card key={branch.id} className="overflow-hidden">
                <div className="h-48 bg-gray-100 relative">
                  {branch.mapEmbedUrl ? (
                    <iframe
                      src={branch.mapEmbedUrl}
                      className="w-full h-full border-0"
                      allowFullScreen={false}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      title={`Map for ${branch.name}`}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                      No map coordinates
                    </div>
                  )}
                </div>
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-gray-900">{branch.name}</h3>
                      <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Open</span>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setEditTarget(branch)} className="h-8 px-3">
                      <Edit className="w-3.5 h-3.5 mr-1.5" />Edit
                    </Button>
                  </div>

                  <div className="space-y-2.5 text-sm">
                    <div className="flex items-start gap-2.5 text-gray-600">
                      <MapPin className="w-4 h-4 text-[#141776] mt-0.5 shrink-0" />
                      <span>{branch.address}</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-gray-600">
                      <Phone className="w-4 h-4 text-[#141776] shrink-0" />
                      <span>{branch.phone}</span>
                    </div>
                    <div className="flex items-start gap-2.5 text-gray-600">
                      <Clock className="w-4 h-4 text-[#141776] mt-0.5 shrink-0" />
                      <div>
                        <p>Mon – Fri: {branch.hoursWeekday}</p>
                        <p>Sat: {branch.hoursSaturday}</p>
                        <p>Sun: {branch.hoursSunday}</p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t flex gap-2 text-xs text-gray-400">
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

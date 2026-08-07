'use client';
import { useState, useEffect } from 'react';
import { Plus, Trash2, Tag, Image as ImageIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { DatePicker } from '../ui/date-picker';
import { Skeleton } from '../ui/skeleton';
import { TableSkeleton } from '../ui/table-skeleton';
import { api } from '../../lib/api';

type DiscountType = 'percentage' | 'fixed';

interface PromoCode {
  id: string;
  code: string;
  description: string;
  discountType: DiscountType;
  value: number;
  categories: string[];
  maxUses: number;
  uses: number;
  expiresAt: string;
  isActive: boolean;
}

interface BannerCampaign {
  id: string;
  title: string;
  imageUrl: string;
  targetUrl: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

const CATEGORIES = [
  'Eyeglasses',
  'Sunglasses',
  'Kids',
  'Computer Glasses',
  'Reading Glasses',
  'Contact Lenses',
  'Accessories',
];

export function Promotions() {
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [banners, setBanners] = useState<BannerCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  /** Validation message from the API for promo / banner actions. */
  const [actionError, setActionError] = useState('');
  const [addPromoOpen, setAddPromoOpen] = useState(false);
  const [addBannerOpen, setAddBannerOpen] = useState(false);

  const [newCode, setNewCode] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newDiscountType, setNewDiscountType] = useState<DiscountType>('percentage');
  const [newValue, setNewValue] = useState('');
  const [newMaxUses, setNewMaxUses] = useState('');
  const [newExpiry, setNewExpiry] = useState('');
  const [newCategories, setNewCategories] = useState<string[]>([]);

  const [newBannerStart, setNewBannerStart] = useState('');
  const [newBannerEnd, setNewBannerEnd] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [codes, banners] = await Promise.all([
          api.admin.promos.list(),
          api.admin.banners.list(),
        ]);

        setPromos(
          codes.map((row) => ({
            id: row.id,
            code: row.code,
            description: '',
            discountType: row.discount_type === 'percent' ? 'percentage' : 'fixed',
            value: row.value,
            categories: [],
            maxUses: row.max_uses || 0,
            uses: row.uses,
            expiresAt: row.expires_at?.split('T')[0] || '',
            isActive: row.is_active,
          })),
        );

        setBanners(
          banners.map((row) => {
            const b = row as unknown as Record<string, string | boolean | null>;
            return {
              id: String(b.id),
              title: String(b.headline ?? ''),
              imageUrl: String(b.image_url ?? ''),
              targetUrl: String(b.target_url ?? ''),
              startDate: String(b.starts_at ?? '').split('T')[0] || '',
              endDate: String(b.ends_at ?? '').split('T')[0] || '',
              isActive: Boolean(b.is_active),
            };
          }),
        );
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function togglePromo(id: string) {
    const previous = promos;
    const current = promos.find((p) => p.id === id);
    setPromos((prev) => prev.map((p) => (p.id === id ? { ...p, isActive: !p.isActive } : p)));
    void (async () => {
      try {
        await api.admin.promos.update(id, { is_active: !current?.isActive });
        setActionError('');
      } catch (e) {
        console.error('toggle promo failed:', e);
        setPromos(previous);
        setActionError((e as Error)?.message ?? 'Could not update the promo code.');
      }
    })();
  }

  function deletePromo(id: string) {
    const previous = promos;
    setPromos((prev) => prev.filter((p) => p.id !== id));
    void (async () => {
      try {
        await api.admin.promos.remove(id);
        setActionError('');
      } catch (e) {
        console.error('delete promo failed:', e);
        setPromos(previous);
        setActionError((e as Error)?.message ?? 'Could not delete the promo code.');
      }
    })();
  }

  function toggleBanner(id: string) {
    const previous = banners;
    const current = banners.find((b) => b.id === id);
    setBanners((prev) => prev.map((b) => (b.id === id ? { ...b, isActive: !b.isActive } : b)));
    void (async () => {
      try {
        await api.admin.banners.update(id, { is_active: !current?.isActive });
        setActionError('');
      } catch (e) {
        console.error('toggle banner failed:', e);
        setBanners(previous);
        setActionError((e as Error)?.message ?? 'Could not update the banner.');
      }
    })();
  }

  function addPromo() {
    if (!newCode || !newValue) return;
    void (async () => {
      try {
        // The API validates the code shape, discount bounds and date window,
        // and owns the `uses`/`max_uses` invariants that `increment_promo_uses`
        // depends on. The previous direct insert skipped all of it.
        await api.admin.promos.create({
          code: newCode.toUpperCase(),
          discount_type: newDiscountType === 'percentage' ? 'percent' : 'fixed',
          value: parseFloat(newValue),
          max_uses: parseInt(newMaxUses) || 100,
          ...(newExpiry ? { expires_at: newExpiry } : {}),
          is_active: true,
        });
        const fresh = await api.admin.promos.list();
        setPromos(
          fresh.map((row) => ({
            id: row.id,
            code: row.code,
            description: '',
            discountType: row.discount_type === 'percent' ? 'percentage' : 'fixed',
            value: row.value,
            categories: [],
            maxUses: row.max_uses || 0,
            uses: row.uses,
            expiresAt: row.expires_at?.split('T')[0] || '',
            isActive: row.is_active,
          })),
        );
        setActionError('');
        // Only clear the form once the API has accepted it — otherwise a
        // rejected code (duplicate, bad value, past expiry) would be lost and
        // the admin would have to retype it.
        setAddPromoOpen(false);
        setNewCode('');
        setNewDesc('');
        setNewValue('');
        setNewMaxUses('');
        setNewExpiry('');
        setNewCategories([]);
      } catch (e) {
        console.error('create promo failed:', e);
        setActionError((e as Error)?.message ?? 'Could not create the promo code.');
      }
    })();
  }

  function usagePct(uses: number, max: number) {
    return Math.min((uses / max) * 100, 100);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Promotions</h2>
        <p className="mt-1 text-gray-500">Manage discount codes and banner campaigns</p>
        {actionError && (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</p>
        )}
      </div>

      <Tabs defaultValue="codes">
        <TabsList>
          <TabsTrigger value="codes">Discount Codes</TabsTrigger>
          <TabsTrigger value="banners">Banner Campaigns</TabsTrigger>
        </TabsList>

        {/* Discount codes tab */}
        <TabsContent value="codes" className="mt-6 space-y-4">
          <div className="flex justify-end">
            <Button
              onClick={() => setAddPromoOpen(true)}
              className="bg-[#141776] hover:bg-[#0f1258]"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Code
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Active Codes</CardTitle>
              <CardDescription>{promos.length} promo codes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">
                        Code
                      </th>
                      <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">
                        Description
                      </th>
                      <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">
                        Discount
                      </th>
                      <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">
                        Usage
                      </th>
                      <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">
                        Expiry
                      </th>
                      <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">
                        Status
                      </th>
                      <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  {loading ? (
                    <TableSkeleton cols={7} />
                  ) : (
                    <tbody>
                      {promos.map((p) => (
                        <tr key={p.id} className="border-b hover:bg-gray-50">
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              <Tag className="h-3.5 w-3.5 text-[#141776]" />
                              <span className="font-mono text-sm font-semibold">{p.code}</span>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-sm text-gray-600">{p.description}</td>
                          <td className="px-3 py-3">
                            <span className="text-sm font-semibold">
                              {p.discountType === 'percentage'
                                ? `${p.value}%`
                                : `KES ${p.value.toLocaleString()}`}
                            </span>
                          </td>
                          <td className="min-w-[120px] px-3 py-3">
                            <div className="mb-1 text-xs text-gray-500">
                              {p.uses}/{p.maxUses}
                            </div>
                            <div className="h-1.5 rounded-full bg-gray-100">
                              <div
                                className={`h-1.5 rounded-full ${usagePct(p.uses, p.maxUses) >= 100 ? 'bg-red-400' : 'bg-[#141776]'}`}
                                style={{ width: `${usagePct(p.uses, p.maxUses)}%` }}
                              />
                            </div>
                          </td>
                          <td className="px-3 py-3 text-sm text-gray-600">{p.expiresAt}</td>
                          <td className="px-3 py-3">
                            <Switch
                              checked={p.isActive}
                              onCheckedChange={() => togglePromo(p.id)}
                            />
                          </td>
                          <td className="px-3 py-3">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-400 hover:text-red-600"
                              onClick={() => deletePromo(p.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  )}
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Banners tab */}
        <TabsContent value="banners" className="mt-6 space-y-4">
          <div className="flex justify-end">
            <Button
              onClick={() => setAddBannerOpen(true)}
              className="bg-[#141776] hover:bg-[#0f1258]"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Banner
            </Button>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {[1, 2].map((i) => (
                <Card key={i}>
                  <CardContent className="p-0">
                    <Skeleton className="h-40 w-full rounded-b-none rounded-t-lg" />
                    <div className="space-y-2 p-4">
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-3 w-2/3" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {banners.map((b) => (
                <Card key={b.id}>
                  <CardContent className="p-0">
                    <img
                      src={b.imageUrl}
                      alt={b.title}
                      className="h-40 w-full rounded-t-lg object-cover"
                    />
                    <div className="p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="font-medium">{b.title}</p>
                        <Switch checked={b.isActive} onCheckedChange={() => toggleBanner(b.id)} />
                      </div>
                      <p className="mb-1 text-xs text-gray-500">Target: {b.targetUrl}</p>
                      <p className="text-xs text-gray-500">
                        {b.startDate} → {b.endDate}
                      </p>
                      <span
                        className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${b.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                      >
                        {b.isActive ? 'Live' : 'Paused'}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Add promo dialog */}
      <Dialog open={addPromoOpen} onOpenChange={setAddPromoOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Discount Code</DialogTitle>
            <DialogDescription>Set up a new promotional discount code</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Code *</Label>
                <Input
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  placeholder="e.g. SUMMER20"
                  className="uppercase"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Discount Type *</Label>
                <Select
                  value={newDiscountType}
                  onValueChange={(v) => setNewDiscountType(v as DiscountType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Fixed (KES)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Value *</Label>
                <Input
                  type="number"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder={newDiscountType === 'percentage' ? '20' : '500'}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Max Uses</Label>
                <Input
                  type="number"
                  value={newMaxUses}
                  onChange={(e) => setNewMaxUses(e.target.value)}
                  placeholder="100"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="e.g. 20% off all eyeglasses"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Expiry Date</Label>
              <DatePicker value={newExpiry} onChange={setNewExpiry} disablePast />
            </div>
            <div className="space-y-1.5">
              <Label>Applicable Categories</Label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() =>
                      setNewCategories((prev) =>
                        prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
                      )
                    }
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${newCategories.includes(c) ? 'bg-[#141776] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setAddPromoOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={addPromo}
                disabled={!newCode || !newValue}
                className="bg-[#141776] hover:bg-[#0f1258]"
              >
                Create Code
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add banner dialog */}
      <Dialog open={addBannerOpen} onOpenChange={setAddBannerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Banner Campaign</DialogTitle>
            <DialogDescription>Upload and schedule a promotional banner</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Campaign Title</Label>
              <Input placeholder="e.g. June Eyeglasses Sale" />
            </div>
            <div className="rounded-lg border-2 border-dashed border-gray-200 p-6 text-center">
              <ImageIcon className="mx-auto mb-2 h-8 w-8 text-gray-400" />
              <p className="text-sm text-gray-500">Upload banner image</p>
              <p className="mt-1 text-xs text-gray-400">
                PNG, JPG up to 2MB — recommended 1200×400
              </p>
              <Button variant="outline" size="sm" className="mt-3">
                Browse files
              </Button>
            </div>
            <div className="space-y-1.5">
              <Label>Target URL</Label>
              <Input placeholder="/products?category=eyeglasses" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Start Date</Label>
                <DatePicker value={newBannerStart} onChange={setNewBannerStart} disablePast />
              </div>
              <div className="space-y-1.5">
                <Label>End Date</Label>
                <DatePicker value={newBannerEnd} onChange={setNewBannerEnd} disablePast />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setAddBannerOpen(false)}>
                Cancel
              </Button>
              <Button className="bg-[#141776] hover:bg-[#0f1258]">Create Campaign</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

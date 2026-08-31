'use client';
import { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Trash2,
  Tag,
  Image as ImageIcon,
  Pencil,
  ExternalLink,
  ArrowUpDown,
  Upload,
} from 'lucide-react';
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
  sortOrder: number;
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

const EMPTY_BANNER_FORM = {
  title: '',
  imageUrl: '',
  targetUrl: '',
  startDate: '',
  endDate: '',
  sortOrder: '0',
};

export function Promotions() {
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [banners, setBanners] = useState<BannerCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  /** Validation message from the API for promo / banner actions. */
  const [actionError, setActionError] = useState('');
  const [addPromoOpen, setAddPromoOpen] = useState(false);

  // ── Banner dialog state ────────────────────────────────────────────────────
  const [bannerDialogOpen, setBannerDialogOpen] = useState(false);
  /** When set, the dialog is in edit mode for this banner id. */
  const [editingBannerId, setEditingBannerId] = useState<string | null>(null);
  const [bannerForm, setBannerForm] = useState(EMPTY_BANNER_FORM);
  const [bannerSaving, setBannerSaving] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Promo code form state ──────────────────────────────────────────────────
  const [newCode, setNewCode] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newDiscountType, setNewDiscountType] = useState<DiscountType>('percentage');
  const [newValue, setNewValue] = useState('');
  const [newMaxUses, setNewMaxUses] = useState('');
  const [newExpiry, setNewExpiry] = useState('');
  const [newCategories, setNewCategories] = useState<string[]>([]);

  // ── Data fetch ─────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [codes, rawBanners] = await Promise.all([
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

        setBanners(rawBanners.map(mapBannerRow));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────────
  function mapBannerRow(row: unknown): BannerCampaign {
    const b = row as Record<string, string | boolean | number | null>;
    return {
      id: String(b.id),
      title: String(b.headline ?? ''),
      imageUrl: String(b.image_url ?? ''),
      targetUrl: String(b.target_url ?? ''),
      startDate: String(b.starts_at ?? '').split('T')[0] || '',
      endDate: String(b.ends_at ?? '').split('T')[0] || '',
      isActive: Boolean(b.is_active),
      sortOrder: Number(b.sort_order ?? 0),
    };
  }

  function openCreateBanner() {
    setEditingBannerId(null);
    setBannerForm(EMPTY_BANNER_FORM);
    setActionError('');
    setBannerDialogOpen(true);
  }

  function openEditBanner(b: BannerCampaign) {
    setEditingBannerId(b.id);
    setBannerForm({
      title: b.title,
      imageUrl: b.imageUrl,
      targetUrl: b.targetUrl,
      startDate: b.startDate,
      endDate: b.endDate,
      sortOrder: String(b.sortOrder),
    });
    setActionError('');
    setBannerDialogOpen(true);
  }

  function closeBannerDialog() {
    setBannerDialogOpen(false);
    setEditingBannerId(null);
    setBannerForm(EMPTY_BANNER_FORM);
  }

  function updateBannerField(field: keyof typeof EMPTY_BANNER_FORM, value: string) {
    setBannerForm((prev) => ({ ...prev, [field]: value }));
  }

  /**
   * Upload a file to the backend which proxies it to the `promo-banners` Supabase Storage bucket
   * and populate the image URL field with the resulting public URL.
   */
  async function uploadBannerImage(file: File) {
    setImageUploading(true);
    setActionError('');
    try {
      const { url } = await api.admin.banners.uploadImage(file);
      updateBannerField('imageUrl', url);
    } catch (e) {
      console.error('image upload failed:', e);
      setActionError((e as Error)?.message ?? 'Could not upload the image.');
    } finally {
      setImageUploading(false);
    }
  }

  // ── Banner CRUD ────────────────────────────────────────────────────────────
  async function saveBanner() {
    if (!bannerForm.imageUrl.trim()) {
      setActionError('Banner Image URL is required.');
      return;
    }
    setBannerSaving(true);
    setActionError('');
    try {
      const payload = {
        image_url: bannerForm.imageUrl.trim(),
        headline: bannerForm.title.trim() || undefined,
        target_url: bannerForm.targetUrl.trim() || undefined,
        starts_at: bannerForm.startDate || undefined,
        ends_at: bannerForm.endDate || undefined,
        sort_order: parseInt(bannerForm.sortOrder) || 0,
      };

      if (editingBannerId) {
        await api.admin.banners.update(editingBannerId, payload);
      } else {
        await api.admin.banners.create({ ...payload, is_active: true });
      }

      // Refresh list
      const fresh = await api.admin.banners.list();
      setBanners(fresh.map(mapBannerRow));
      closeBannerDialog();
    } catch (e) {
      console.error('save banner failed:', e);
      setActionError((e as Error)?.message ?? 'Could not save the banner.');
    } finally {
      setBannerSaving(false);
    }
  }

  function deleteBanner(id: string) {
    const previous = banners;
    setBanners((prev) => prev.filter((b) => b.id !== id));
    void (async () => {
      try {
        await api.admin.banners.remove(id);
        setActionError('');
      } catch (e) {
        console.error('delete banner failed:', e);
        setBanners(previous);
        setActionError((e as Error)?.message ?? 'Could not delete the banner.');
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

  // ── Promo code CRUD ────────────────────────────────────────────────────────
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

  function addPromo() {
    if (!newCode || !newValue) return;
    void (async () => {
      try {
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

  // ── Render ─────────────────────────────────────────────────────────────────
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

        {/* ── Discount codes tab ──────────────────────────────────────────────── */}
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

        {/* ── Banners tab ─────────────────────────────────────────────────────── */}
        <TabsContent value="banners" className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Banners are shown in <strong>sort order</strong> as a carousel on the homepage. Only{' '}
              <span className="font-semibold text-green-700">active</span> banners within their date
              window are displayed.
            </p>
            <Button
              onClick={openCreateBanner}
              className="ml-4 shrink-0 bg-[#141776] hover:bg-[#0f1258]"
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
          ) : banners.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-12">
                <ImageIcon className="h-10 w-10 text-gray-300" />
                <p className="text-sm text-gray-500">No banner campaigns yet.</p>
                <Button
                  size="sm"
                  className="bg-[#141776] hover:bg-[#0f1258]"
                  onClick={openCreateBanner}
                >
                  <Plus className="mr-2 h-3.5 w-3.5" />
                  Create your first banner
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {banners.map((b) => (
                <Card key={b.id} className="overflow-hidden">
                  <CardContent className="p-0">
                    {/* Preview image */}
                    <div className="relative h-40 w-full bg-gray-100">
                      {b.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={b.imageUrl}
                          alt={b.title || 'Banner'}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <ImageIcon className="h-10 w-10 text-gray-300" />
                        </div>
                      )}
                      {/* Sort order badge */}
                      <span className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-[11px] font-bold text-white">
                        {b.sortOrder}
                      </span>
                    </div>

                    <div className="p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="font-semibold text-gray-900">{b.title || '(no headline)'}</p>
                        <Switch checked={b.isActive} onCheckedChange={() => toggleBanner(b.id)} />
                      </div>

                      {/* Target URL chip */}
                      {b.targetUrl && (
                        <a
                          href={b.targetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mb-2 flex items-center gap-1 text-xs text-[#141776] hover:underline"
                        >
                          <ExternalLink className="h-3 w-3 shrink-0" />
                          <span className="truncate">{b.targetUrl}</span>
                        </a>
                      )}

                      <p className="mb-3 text-xs text-gray-400">
                        {b.startDate || '—'} → {b.endDate || '—'}
                      </p>

                      <div className="flex items-center justify-between">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                            b.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {b.isActive ? 'Live' : 'Paused'}
                        </span>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-gray-400 hover:text-[#141776]"
                            onClick={() => openEditBanner(b)}
                            aria-label="Edit banner"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-400 hover:text-red-600"
                            onClick={() => deleteBanner(b.id)}
                            aria-label="Delete banner"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Add promo dialog ─────────────────────────────────────────────────── */}
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
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      newCategories.includes(c)
                        ? 'bg-[#141776] text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
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

      {/* ── Create / Edit banner dialog ──────────────────────────────────────── */}
      <Dialog open={bannerDialogOpen} onOpenChange={setBannerDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingBannerId ? 'Edit Banner' : 'New Banner Campaign'}</DialogTitle>
            <DialogDescription>
              {editingBannerId
                ? "Update this banner's details. Changes go live within 60 seconds."
                : 'Add a new hero banner. It will appear in the carousel on the homepage.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Headline */}
            <div className="space-y-1.5">
              <Label>Headline / Title</Label>
              <Input
                value={bannerForm.title}
                onChange={(e) => updateBannerField('title', e.target.value)}
                placeholder="e.g. Summer Sale\nUp to 40% off"
              />
              <p className="text-xs text-gray-400">
                Use <code>\n</code> in the stored text to split into multiple lines on the banner.
              </p>
            </div>

            {/* Image URL + upload button */}
            <div className="space-y-1.5">
              <Label>Banner Image *</Label>
              <div className="flex gap-2">
                <Input
                  value={bannerForm.imageUrl}
                  onChange={(e) => updateBannerField('imageUrl', e.target.value)}
                  placeholder="https://... or upload below"
                  className="flex-1"
                />
                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadBannerImage(file);
                    // Reset so the same file can be re-selected after an error
                    e.target.value = '';
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  disabled={imageUploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {imageUploading ? (
                    <span className="flex items-center gap-1 text-xs">
                      <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      Uploading
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs">
                      <Upload className="h-3 w-3" />
                      Upload
                    </span>
                  )}
                </Button>
              </div>
              <p className="text-xs text-gray-400">
                Upload a file (PNG/JPG/WebP, recommended 1440×773) or paste a URL directly.
              </p>
              {bannerForm.imageUrl && (
                <div className="mt-2 h-24 w-full overflow-hidden rounded-md border bg-gray-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={bannerForm.imageUrl}
                    alt="Preview"
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>

            {/* Target / redirect URL */}
            <div className="space-y-1.5">
              <Label>Redirect Path (Target URL)</Label>
              <Input
                value={bannerForm.targetUrl}
                onChange={(e) => updateBannerField('targetUrl', e.target.value)}
                placeholder="/shop or /category/sunglasses"
              />
              <p className="text-xs text-gray-400">
                Clicking the banner will navigate here. Use a relative path (e.g. <code>/shop</code>
                ) or an absolute URL.
              </p>
            </div>

            {/* Sort order */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1">
                <ArrowUpDown className="h-3.5 w-3.5" />
                Sort Order
              </Label>
              <Input
                type="number"
                min={0}
                value={bannerForm.sortOrder}
                onChange={(e) => updateBannerField('sortOrder', e.target.value)}
                placeholder="0"
              />
              <p className="text-xs text-gray-400">Lower number = shown first in the carousel.</p>
            </div>

            {/* Date window */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Start Date</Label>
                <DatePicker
                  value={bannerForm.startDate}
                  onChange={(v) => updateBannerField('startDate', v)}
                  disablePast
                />
              </div>
              <div className="space-y-1.5">
                <Label>End Date</Label>
                <DatePicker
                  value={bannerForm.endDate}
                  onChange={(v) => updateBannerField('endDate', v)}
                  disablePast
                />
              </div>
            </div>

            {actionError && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</p>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={closeBannerDialog} disabled={bannerSaving}>
                Cancel
              </Button>
              <Button
                onClick={saveBanner}
                disabled={!bannerForm.imageUrl.trim() || bannerSaving}
                className="bg-[#141776] hover:bg-[#0f1258]"
              >
                {bannerSaving ? 'Saving…' : editingBannerId ? 'Save Changes' : 'Create Banner'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

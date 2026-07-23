'use client'
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
import { createBrowserSupabase } from '@optex/db/browser';

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

const CATEGORIES = ['Eyeglasses', 'Sunglasses', 'Kids', 'Computer Glasses', 'Reading Glasses', 'Contact Lenses', 'Accessories'];

export function Promotions() {
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [banners, setBanners] = useState<BannerCampaign[]>([]);
  const [loading, setLoading] = useState(true);
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
    const db = createBrowserSupabase();
    (async () => {
      try {
        const [codesRes, bannersRes] = await Promise.all([
          db.from('promo_codes').select('*').order('created_at', { ascending: false }),
          db.from('promo_banners').select('*').order('sort_order'),
        ]);
        if (codesRes.error) console.error(codesRes.error);
        if (bannersRes.error) console.error(bannersRes.error);

        const mappedCodes: PromoCode[] = (codesRes.data ?? []).map((row: any) => ({
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
        }));

        const mappedBanners: BannerCampaign[] = (bannersRes.data ?? []).map((row: any) => ({
          id: row.id,
          title: row.headline || '',
          imageUrl: row.image_url,
          targetUrl: row.target_url || '',
          startDate: row.starts_at?.split('T')[0] || '',
          endDate: row.ends_at?.split('T')[0] || '',
          isActive: row.is_active,
        }));

        setPromos(mappedCodes);
        setBanners(mappedBanners);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function togglePromo(id: string) {
    setPromos(prev => prev.map(p => p.id === id ? { ...p, isActive: !p.isActive } : p));
    const db = createBrowserSupabase();
    const current = promos.find(p => p.id === id);
    void (async () => { try { await db.from('promo_codes').update({ is_active: !(current?.isActive) }).eq('id', id); } catch(e) { console.error(e); } })();
  }

  function deletePromo(id: string) {
    setPromos(prev => prev.filter(p => p.id !== id));
    const db = createBrowserSupabase();
    void (async () => { try { await db.from('promo_codes').delete().eq('id', id); } catch(e) { console.error(e); } })();
  }

  function toggleBanner(id: string) {
    setBanners(prev => prev.map(b => b.id === id ? { ...b, isActive: !b.isActive } : b));
    const db = createBrowserSupabase();
    const current = banners.find(b => b.id === id);
    void (async () => { try { await db.from('promo_banners').update({ is_active: !(current?.isActive) }).eq('id', id); } catch(e) { console.error(e); } })();
  }

  function addPromo() {
    if (!newCode || !newValue) return;
    const db = createBrowserSupabase();
    void (async () => {
      try {
        await db.from('promo_codes').insert({
          code: newCode.toUpperCase(),
          discount_type: newDiscountType === 'percentage' ? 'percent' : 'fixed',
          value: parseFloat(newValue),
          max_uses: parseInt(newMaxUses) || 100,
          expires_at: newExpiry || null,
          is_active: true,
        });
        // Refresh list after insert
        const { data, error } = await db.from('promo_codes').select('*').order('created_at', { ascending: false });
        if (error) { console.error(error); return; }
        const mappedCodes: PromoCode[] = (data ?? []).map((row: any) => ({
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
        }));
        setPromos(mappedCodes);
      } catch(e) {
        console.error(e);
      }
    })();
    setAddPromoOpen(false);
    setNewCode(''); setNewDesc(''); setNewValue(''); setNewMaxUses(''); setNewExpiry(''); setNewCategories([]);
  }

  function usagePct(uses: number, max: number) { return Math.min((uses / max) * 100, 100); }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-bold text-2xl text-gray-900">Promotions</h2>
        <p className="text-gray-500 mt-1">Manage discount codes and banner campaigns</p>
      </div>

      <Tabs defaultValue="codes">
        <TabsList>
          <TabsTrigger value="codes">Discount Codes</TabsTrigger>
          <TabsTrigger value="banners">Banner Campaigns</TabsTrigger>
        </TabsList>

        {/* Discount codes tab */}
        <TabsContent value="codes" className="mt-6 space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setAddPromoOpen(true)} className="bg-[#141776] hover:bg-[#0f1258]">
              <Plus className="w-4 h-4 mr-2" />New Code
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
                      <th className="text-left py-3 px-3 text-sm font-medium text-gray-700">Code</th>
                      <th className="text-left py-3 px-3 text-sm font-medium text-gray-700">Description</th>
                      <th className="text-left py-3 px-3 text-sm font-medium text-gray-700">Discount</th>
                      <th className="text-left py-3 px-3 text-sm font-medium text-gray-700">Usage</th>
                      <th className="text-left py-3 px-3 text-sm font-medium text-gray-700">Expiry</th>
                      <th className="text-left py-3 px-3 text-sm font-medium text-gray-700">Status</th>
                      <th className="text-left py-3 px-3 text-sm font-medium text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  {loading ? (
                    <TableSkeleton cols={7} />
                  ) : (
                    <tbody>
                      {promos.map(p => (
                        <tr key={p.id} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              <Tag className="w-3.5 h-3.5 text-[#141776]" />
                              <span className="font-mono font-semibold text-sm">{p.code}</span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-sm text-gray-600">{p.description}</td>
                          <td className="py-3 px-3">
                            <span className="font-semibold text-sm">
                              {p.discountType === 'percentage' ? `${p.value}%` : `KES ${p.value.toLocaleString()}`}
                            </span>
                          </td>
                          <td className="py-3 px-3 min-w-[120px]">
                            <div className="text-xs text-gray-500 mb-1">{p.uses}/{p.maxUses}</div>
                            <div className="bg-gray-100 rounded-full h-1.5">
                              <div
                                className={`h-1.5 rounded-full ${usagePct(p.uses, p.maxUses) >= 100 ? 'bg-red-400' : 'bg-[#141776]'}`}
                                style={{ width: `${usagePct(p.uses, p.maxUses)}%` }}
                              />
                            </div>
                          </td>
                          <td className="py-3 px-3 text-sm text-gray-600">{p.expiresAt}</td>
                          <td className="py-3 px-3">
                            <Switch checked={p.isActive} onCheckedChange={() => togglePromo(p.id)} />
                          </td>
                          <td className="py-3 px-3">
                            <Button variant="ghost" size="icon" className="w-7 h-7 text-red-400 hover:text-red-600" onClick={() => deletePromo(p.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
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
            <Button onClick={() => setAddBannerOpen(true)} className="bg-[#141776] hover:bg-[#0f1258]">
              <Plus className="w-4 h-4 mr-2" />New Banner
            </Button>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2].map(i => (
                <Card key={i}>
                  <CardContent className="p-0">
                    <Skeleton className="w-full h-40 rounded-t-lg rounded-b-none" />
                    <div className="p-4 space-y-2">
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-3 w-2/3" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {banners.map(b => (
                <Card key={b.id}>
                  <CardContent className="p-0">
                    <img src={b.imageUrl} alt={b.title} className="w-full h-40 object-cover rounded-t-lg" />
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-medium">{b.title}</p>
                        <Switch checked={b.isActive} onCheckedChange={() => toggleBanner(b.id)} />
                      </div>
                      <p className="text-xs text-gray-500 mb-1">Target: {b.targetUrl}</p>
                      <p className="text-xs text-gray-500">{b.startDate} → {b.endDate}</p>
                      <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-xs font-medium ${b.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
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
                <Input value={newCode} onChange={e => setNewCode(e.target.value)} placeholder="e.g. SUMMER20" className="uppercase" />
              </div>
              <div className="space-y-1.5">
                <Label>Discount Type *</Label>
                <Select value={newDiscountType} onValueChange={v => setNewDiscountType(v as DiscountType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
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
                <Input type="number" value={newValue} onChange={e => setNewValue(e.target.value)} placeholder={newDiscountType === 'percentage' ? '20' : '500'} />
              </div>
              <div className="space-y-1.5">
                <Label>Max Uses</Label>
                <Input type="number" value={newMaxUses} onChange={e => setNewMaxUses(e.target.value)} placeholder="100" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="e.g. 20% off all eyeglasses" />
            </div>
            <div className="space-y-1.5">
              <Label>Expiry Date</Label>
              <DatePicker value={newExpiry} onChange={setNewExpiry} disablePast />
            </div>
            <div className="space-y-1.5">
              <Label>Applicable Categories</Label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewCategories(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${newCategories.includes(c) ? 'bg-[#141776] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setAddPromoOpen(false)}>Cancel</Button>
              <Button onClick={addPromo} disabled={!newCode || !newValue} className="bg-[#141776] hover:bg-[#0f1258]">Create Code</Button>
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
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center">
              <ImageIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Upload banner image</p>
              <p className="text-xs text-gray-400 mt-1">PNG, JPG up to 2MB — recommended 1200×400</p>
              <Button variant="outline" size="sm" className="mt-3">Browse files</Button>
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
              <Button variant="outline" onClick={() => setAddBannerOpen(false)}>Cancel</Button>
              <Button className="bg-[#141776] hover:bg-[#0f1258]">Create Campaign</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

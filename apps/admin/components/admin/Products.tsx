'use client'
import { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Eye, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';
import { Switch } from '../ui/switch';
import { createBrowserSupabase } from '@optex/db/browser';
import { listAllProducts, listCategories } from '@optex/db';
import type { AdminProduct } from '@optex/db';
import type { Category as DbCategory } from '@optex/db';
import { TableSkeleton } from '../ui/table-skeleton';

type CategoryFilter = 'All' | string;

function StockBadge({ isActive }: { isActive: boolean }) {
  if (!isActive) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Inactive</span>;
  return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Active</span>;
}

function productImage(p: AdminProduct) {
  const src = p.images?.[0];
  if (!src) return '';
  if (src.startsWith('http')) return src;
  return '';
}

function ProductFormDialog({
  open,
  onOpenChange,
  product,
  categories,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  product?: AdminProduct;
  categories: DbCategory[];
  onSave: (data: Partial<AdminProduct>) => void;
}) {
  const isEdit = !!product;

  const [name, setName] = useState(product?.name ?? '');
  const [sku, setSku] = useState(product?.sku ?? '');
  const [categoryId, setCategoryId] = useState(product?.category_id ?? '');
  const [brand, setBrand] = useState(product?.brand ?? '');
  const [priceKes, setPriceKes] = useState(product?.price_kes != null ? String(product.price_kes) : '');
  const [frameMaterial, setFrameMaterial] = useState(product?.frame_material ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [imageUrl, setImageUrl] = useState(product?.images?.[0] ?? '');
  const [tryOnUrl, setTryOnUrl] = useState(product?.try_on_image_url ?? '');
  const [isActive, setIsActive] = useState(product?.is_active ?? true);

  useEffect(() => {
    setName(product?.name ?? '');
    setSku(product?.sku ?? '');
    setCategoryId(product?.category_id ?? '');
    setBrand(product?.brand ?? '');
    setPriceKes(product?.price_kes != null ? String(product.price_kes) : '');
    setFrameMaterial(product?.frame_material ?? '');
    setDescription(product?.description ?? '');
    setImageUrl(product?.images?.[0] ?? '');
    setTryOnUrl(product?.try_on_image_url ?? '');
    setIsActive(product?.is_active ?? true);
  }, [product]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Product' : 'Add New Product'}</DialogTitle>
          <DialogDescription>Fill in all required fields to {isEdit ? 'update the' : 'add a new'} product.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="pname">Product Name *</Label>
              <Input id="pname" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Ray-Ban Aviator" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="psku">SKU *</Label>
              <Input id="psku" value={sku} onChange={e => setSku(e.target.value)} placeholder="e.g. RB-3025" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Category *</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pbrand">Brand</Label>
              <Input id="pbrand" value={brand} onChange={e => setBrand(e.target.value)} placeholder="e.g. Ray-Ban" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="pprice">Price (KES) *</Label>
              <Input id="pprice" type="number" value={priceKes} onChange={e => setPriceKes(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pmaterial">Frame Material</Label>
              <Input id="pmaterial" value={frameMaterial} onChange={e => setFrameMaterial(e.target.value)} placeholder="e.g. Acetate, Metal" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pdesc">Description</Label>
            <Textarea id="pdesc" value={description} onChange={e => setDescription(e.target.value)} placeholder="Product description shown on PDP" rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pimage">Image URL</Label>
            <Input id="pimage" value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://..." />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ptryon">Try-On PNG URL (Phase 3)</Label>
            <Input id="ptryon" value={tryOnUrl} onChange={e => setTryOnUrl(e.target.value)} placeholder="Transparent PNG for virtual try-on" />
          </div>
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-2">
              <Switch id="pactive" checked={isActive} onCheckedChange={v => setIsActive(v)} />
              <Label htmlFor="pactive">Active (visible on site)</Label>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button
                className="bg-[#141776] hover:bg-[#0f1258]"
                onClick={() => onSave({
                  name,
                  sku,
                  category_id: categoryId,
                  brand: brand || null,
                  price_kes: parseFloat(priceKes) || 0,
                  frame_material: frameMaterial || null,
                  description: description || null,
                  images: imageUrl ? [imageUrl] : [],
                  try_on_image_url: tryOnUrl || null,
                  is_active: isActive,
                })}
              >
                {isEdit ? 'Save Changes' : 'Add Product'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function Products() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('All');
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [categories, setCategories] = useState<DbCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<AdminProduct | undefined>();

  useEffect(() => {
    const db = createBrowserSupabase();
    Promise.all([listAllProducts(db), listCategories(db)])
      .then(([prods, cats]) => { setProducts(prods); setCategories(cats); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function handleAddProduct(data: Partial<AdminProduct>) {
    const db = createBrowserSupabase();
    const slug = (data.name ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now();
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await db.from('products').insert({ ...data, slug } as any);
      if (error) { console.error(error); return; }
      setAddOpen(false);
      const prods = await listAllProducts(db);
      setProducts(prods);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleEditProduct(data: Partial<AdminProduct>) {
    if (!editProduct) return;
    const db = createBrowserSupabase();
    try {
      const { error } = await db.from('products').update(data).eq('id', editProduct.id);
      if (error) { console.error(error); return; }
      setEditProduct(undefined);
      const prods = await listAllProducts(db);
      setProducts(prods);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDeleteProduct(id: string) {
    if (!confirm('Delete this product? This cannot be undone.')) return;
    const db = createBrowserSupabase();
    try {
      const { error } = await db.from('products').update({ is_active: false }).eq('id', id);
      if (error) { console.error(error); return; }
      setProducts(prev => prev.map(p => p.id === id ? { ...p, is_active: false } : p));
    } catch (err) {
      console.error(err);
    }
  }

  const categoryTabs: CategoryFilter[] = ['All', ...categories.map(c => c.name)];

  const filtered = products.filter(p => {
    const matchSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.brand ?? '').toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchSearch) return false;
    if (activeCategory === 'All') return true;
    const cat = categories.find(c => c.name === activeCategory);
    return cat ? p.category_id === cat.id : true;
  });

  function categoryName(categoryId: string) {
    return categories.find(c => c.id === categoryId)?.name ?? '—';
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-2xl text-gray-900">Products</h2>
          <p className="text-gray-500 mt-1">Manage your product catalog</p>
        </div>
        <Button onClick={() => setAddOpen(true)} className="bg-[#141776] hover:bg-[#0f1258]">
          <Plus className="w-4 h-4 mr-2" />
          Add Product
        </Button>
      </div>

      <ProductFormDialog open={addOpen} onOpenChange={setAddOpen} categories={categories} onSave={handleAddProduct} />
      <ProductFormDialog
        open={!!editProduct}
        onOpenChange={(v) => !v && setEditProduct(undefined)}
        product={editProduct}
        categories={categories}
        onSave={handleEditProduct}
      />

      {/* Category filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {categoryTabs.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeCategory === cat
                ? 'bg-[#141776] text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Product List</CardTitle>
              <CardDescription>{filtered.length} products</CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by name, SKU, brand..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-3 font-medium text-gray-700 text-sm">Product</th>
                  <th className="text-left py-3 px-3 font-medium text-gray-700 text-sm">SKU</th>
                  <th className="text-left py-3 px-3 font-medium text-gray-700 text-sm">Category</th>
                  <th className="text-left py-3 px-3 font-medium text-gray-700 text-sm">Brand</th>
                  <th className="text-left py-3 px-3 font-medium text-gray-700 text-sm">Price (KES)</th>
                  <th className="text-left py-3 px-3 font-medium text-gray-700 text-sm">Status</th>
                  <th className="text-left py-3 px-3 font-medium text-gray-700 text-sm">Actions</th>
                </tr>
              </thead>
              {loading ? (
                <TableSkeleton cols={7} />
              ) : (
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-sm text-gray-400">No products found.</td>
                    </tr>
                  ) : filtered.map((product) => (
                    <tr key={product.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-3">
                          {productImage(product) ? (
                            <img src={productImage(product)} alt={product.name} className="w-10 h-10 rounded-lg object-cover" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-xs text-gray-400">IMG</div>
                          )}
                          <span className="font-medium text-sm">{product.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-sm text-gray-500 font-mono">{product.sku}</td>
                      <td className="py-3 px-3 text-sm">{categoryName(product.category_id)}</td>
                      <td className="py-3 px-3 text-sm text-gray-600">{product.brand ?? '—'}</td>
                      <td className="py-3 px-3 text-sm font-medium">{Number(product.price_kes).toLocaleString()}</td>
                      <td className="py-3 px-3">
                        <StockBadge isActive={product.is_active} />
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="w-7 h-7">
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => setEditProduct(product)}>
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="w-7 h-7 text-red-500 hover:text-red-700" onClick={() => handleDeleteProduct(product.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              )}
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

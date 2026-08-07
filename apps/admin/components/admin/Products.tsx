'use client';
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
import { api } from '../../lib/api';
import type {
  Product as AdminProduct,
  Category as DbCategory,
  UpdateProductInput,
} from '@optex/api-client';
import { TableSkeleton } from '../ui/table-skeleton';

type CategoryFilter = 'All' | string;

function StockBadge({ isActive }: { isActive: boolean }) {
  if (!isActive)
    return (
      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
        Inactive
      </span>
    );
  return (
    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
      Active
    </span>
  );
}

/** The API caps `limit` at 100 per page. */
const PRODUCT_PAGE_SIZE = 100;

/**
 * Fetch every product, active or inactive, by walking the pages.
 *
 * `/products/admin/all` includes deactivated rows where the public list does
 * not. The grid searches and filters client-side, so a truncated first page
 * would silently hide products from the admin rather than showing fewer —
 * hence paging to exhaustion instead of requesting one oversized page.
 */
async function fetchAllProducts(): Promise<AdminProduct[]> {
  const all: AdminProduct[] = [];
  for (let page = 1; ; page += 1) {
    const res = await api.admin.products.listAll({ page, limit: PRODUCT_PAGE_SIZE });
    all.push(...res.items);
    if (all.length >= res.total || res.items.length === 0) break;
  }
  return all;
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
  const [priceKes, setPriceKes] = useState(
    product?.price_kes != null ? String(product.price_kes) : '',
  );
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
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Product' : 'Add New Product'}</DialogTitle>
          <DialogDescription>
            Fill in all required fields to {isEdit ? 'update the' : 'add a new'} product.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="pname">Product Name *</Label>
              <Input
                id="pname"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ray-Ban Aviator"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="psku">SKU *</Label>
              <Input
                id="psku"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="e.g. RB-3025"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Category *</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pbrand">Brand</Label>
              <Input
                id="pbrand"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="e.g. Ray-Ban"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="pprice">Price (KES) *</Label>
              <Input
                id="pprice"
                type="number"
                value={priceKes}
                onChange={(e) => setPriceKes(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pmaterial">Frame Material</Label>
              <Input
                id="pmaterial"
                value={frameMaterial}
                onChange={(e) => setFrameMaterial(e.target.value)}
                placeholder="e.g. Acetate, Metal"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pdesc">Description</Label>
            <Textarea
              id="pdesc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Product description shown on PDP"
              rows={3}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pimage">Image URL</Label>
            <Input
              id="pimage"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ptryon">Try-On PNG URL (Phase 3)</Label>
            <Input
              id="ptryon"
              value={tryOnUrl}
              onChange={(e) => setTryOnUrl(e.target.value)}
              placeholder="Transparent PNG for virtual try-on"
            />
          </div>
          <div className="flex items-center justify-between border-t pt-2">
            <div className="flex items-center gap-2">
              <Switch id="pactive" checked={isActive} onCheckedChange={(v) => setIsActive(v)} />
              <Label htmlFor="pactive">Active (visible on site)</Label>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                className="bg-[#141776] hover:bg-[#0f1258]"
                onClick={() =>
                  onSave({
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
                  })
                }
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
  /** Validation message from the API for create / update / deactivate. */
  const [formError, setFormError] = useState('');

  useEffect(() => {
    Promise.all([fetchAllProducts(), api.catalog.listCategories()])
      .then(([prods, cats]) => {
        setProducts(prods);
        setCategories(cats);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  /**
   * Map the dialog's form state onto the API's product DTO.
   *
   * Two things matter here. The API runs `forbidNonWhitelisted`, so any field
   * outside the DTO (`id`, `created_at`, the generated `search_tsv`) is a 400
   * rather than a silent strip — we therefore pick fields explicitly instead
   * of spreading. And the form uses `null` for "empty", while the DTO types
   * optionals as `string | undefined`, so nulls are normalised to undefined.
   */
  function toProductInput(data: Partial<AdminProduct>): UpdateProductInput {
    const orUndefined = (v: string | null | undefined) => (v == null || v === '' ? undefined : v);
    return {
      name: orUndefined(data.name),
      sku: orUndefined(data.sku),
      category_id: orUndefined(data.category_id),
      brand: orUndefined(data.brand),
      price_kes: data.price_kes ?? undefined,
      frame_material: orUndefined(data.frame_material),
      frame_shape: orUndefined(data.frame_shape),
      gender: orUndefined(data.gender),
      description: orUndefined(data.description),
      images: data.images ?? undefined,
      try_on_image_url: orUndefined(data.try_on_image_url),
      is_active: data.is_active ?? undefined,
    };
  }

  async function refreshProducts() {
    setProducts(await fetchAllProducts());
  }

  async function handleAddProduct(data: Partial<AdminProduct>) {
    const slug =
      (data.name ?? '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') +
      '-' +
      Date.now();
    try {
      const input = toProductInput(data);
      if (!input.name || !input.sku || !input.category_id) {
        setFormError('Name, SKU and category are required.');
        return;
      }
      await api.admin.products.create({
        ...input,
        name: input.name,
        sku: input.sku,
        category_id: input.category_id,
        price_kes: input.price_kes ?? 0,
        slug,
      });
      setAddOpen(false);
      setFormError('');
      await refreshProducts();
    } catch (err) {
      console.error('create product failed:', err);
      setFormError((err as Error)?.message ?? 'Could not create the product.');
    }
  }

  async function handleEditProduct(data: Partial<AdminProduct>) {
    if (!editProduct) return;
    try {
      await api.admin.products.update(editProduct.id, toProductInput(data));
      setEditProduct(undefined);
      setFormError('');
      await refreshProducts();
    } catch (err) {
      console.error('update product failed:', err);
      setFormError((err as Error)?.message ?? 'Could not save the product.');
    }
  }

  async function handleDeleteProduct(id: string) {
    if (!confirm('Deactivate this product? It will be hidden from the storefront.')) return;
    try {
      await api.admin.products.remove(id);
      setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, is_active: false } : p)));
      setFormError('');
    } catch (err) {
      console.error('deactivate product failed:', err);
      setFormError((err as Error)?.message ?? 'Could not deactivate the product.');
    }
  }

  const categoryTabs: CategoryFilter[] = ['All', ...categories.map((c) => c.name)];

  const filtered = products.filter((p) => {
    const matchSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.brand ?? '').toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchSearch) return false;
    if (activeCategory === 'All') return true;
    const cat = categories.find((c) => c.name === activeCategory);
    return cat ? p.category_id === cat.id : true;
  });

  // `products.category_id` is nullable in the schema, so an uncategorised
  // product renders a dash rather than being treated as a lookup miss.
  function categoryName(categoryId: string | null) {
    if (!categoryId) return '—';
    return categories.find((c) => c.id === categoryId)?.name ?? '—';
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Products</h2>
          <p className="mt-1 text-gray-500">Manage your product catalog</p>
        </div>
        <Button onClick={() => setAddOpen(true)} className="bg-[#141776] hover:bg-[#0f1258]">
          <Plus className="mr-2 h-4 w-4" />
          Add Product
        </Button>
      </div>

      <ProductFormDialog
        open={addOpen}
        onOpenChange={(v) => {
          setAddOpen(v);
          if (!v) setFormError('');
        }}
        categories={categories}
        onSave={handleAddProduct}
      />
      <ProductFormDialog
        open={!!editProduct}
        onOpenChange={(v) => {
          if (!v) {
            setEditProduct(undefined);
            setFormError('');
          }
        }}
        product={editProduct}
        categories={categories}
        onSave={handleEditProduct}
      />

      {formError && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
      )}

      {/* Category filter tabs */}
      <div className="flex flex-wrap gap-2">
        {categoryTabs.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              activeCategory === cat
                ? 'bg-[#141776] text-white'
                : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
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
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
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
                  <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">Product</th>
                  <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">SKU</th>
                  <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">
                    Category
                  </th>
                  <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">Brand</th>
                  <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">
                    Price (KES)
                  </th>
                  <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">Status</th>
                  <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              {loading ? (
                <TableSkeleton cols={7} />
              ) : (
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-sm text-gray-400">
                        No products found.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((product) => (
                      <tr key={product.id} className="border-b hover:bg-gray-50">
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-3">
                            {productImage(product) ? (
                              <img
                                src={productImage(product)}
                                alt={product.name}
                                className="h-10 w-10 rounded-lg object-cover"
                              />
                            ) : (
                              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-xs text-gray-400">
                                IMG
                              </div>
                            )}
                            <span className="text-sm font-medium">{product.name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 font-mono text-sm text-gray-500">{product.sku}</td>
                        <td className="px-3 py-3 text-sm">{categoryName(product.category_id)}</td>
                        <td className="px-3 py-3 text-sm text-gray-600">{product.brand ?? '—'}</td>
                        <td className="px-3 py-3 text-sm font-medium">
                          {Number(product.price_kes).toLocaleString()}
                        </td>
                        <td className="px-3 py-3">
                          <StockBadge isActive={product.is_active} />
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => setEditProduct(product)}
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-500 hover:text-red-700"
                              onClick={() => handleDeleteProduct(product.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              )}
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

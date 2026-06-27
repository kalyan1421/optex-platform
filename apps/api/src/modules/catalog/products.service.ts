import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductQueryDto, ProductSort } from './dto/product-query.dto';
import { SearchQueryDto } from './dto/search-query.dto';
import { UpdateProductDto } from './dto/update-product.dto';

/** Storage bucket holding product gallery images (see migration 0003). */
const PRODUCT_IMAGES_BUCKET = 'product-images';

/** Full-text config matching the generated `search_tsv` column. */
const TSV_CONFIG = 'simple';

/** Shape of an uploaded multipart file (subset of Express.Multer.File). */
export interface UploadedImage {
  originalname: string;
  buffer: Buffer;
  mimetype: string;
  size: number;
}

/** A single product row as returned by Supabase (`select('*')`). */
export type ProductRow = Record<string, unknown> & {
  id: string;
  slug: string;
  category_id: string | null;
  images: string[];
  is_active: boolean;
};

/** Paginated envelope returned by list/search endpoints. */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

/** Loosely-typed UUID v4 / v1 matcher used to distinguish id from slug. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Catalog read/write logic for products. Uses the service-role Supabase client
 * (RLS-bypassing); public reads are constrained to active products in code.
 */
@Injectable()
export class ProductsService {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Paginated, filtered list of active products.
   * Returns `{ items, total, page, limit }`.
   */
  async list(query: ProductQueryDto): Promise<Paginated<ProductRow>> {
    const { page, limit } = query;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let builder = this.supabase.client
      .from('products')
      .select('*', { count: 'exact' })
      .eq('is_active', true);

    if (query.brand) builder = builder.eq('brand', query.brand);
    if (query.shape) builder = builder.eq('frame_shape', query.shape);
    if (query.gender) builder = builder.eq('gender', query.gender);
    if (query.material) builder = builder.eq('frame_material', query.material);
    if (query.minPrice !== undefined)
      builder = builder.gte('price_kes', query.minPrice);
    if (query.maxPrice !== undefined)
      builder = builder.lte('price_kes', query.maxPrice);

    if (query.category) {
      const categoryId = await this.resolveCategoryId(query.category);
      if (!categoryId) {
        return { items: [], total: 0, page, limit };
      }
      builder = builder.eq('category_id', categoryId);
    }

    // `featured` has no dedicated column yet, so it falls back to newest-first.
    const sorted =
      query.sort === ProductSort.PriceAsc
        ? builder.order('price_kes', { ascending: true })
        : query.sort === ProductSort.PriceDesc
          ? builder.order('price_kes', { ascending: false })
          : builder.order('created_at', { ascending: false });

    const { data, error, count } = await sorted.range(from, to);
    if (error) throw new BadRequestException(error.message);

    return {
      items: (data ?? []) as ProductRow[],
      total: count ?? 0,
      page,
      limit,
    };
  }

  /**
   * Full-text search over active products using the `search_tsv` column.
   * Falls back to an ilike match on name/brand when the tsv search yields
   * nothing (e.g. partial-token queries).
   */
  async search(query: SearchQueryDto): Promise<Paginated<ProductRow>> {
    const { page, limit } = query;
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const q = query.q.trim();

    if (!q) {
      return { items: [], total: 0, page, limit };
    }

    // Primary: websearch full-text query against the generated tsvector.
    const {
      data: tsData,
      error: tsError,
      count: tsCount,
    } = await this.supabase.client
      .from('products')
      .select('*', { count: 'exact' })
      .eq('is_active', true)
      .textSearch('search_tsv', q, { type: 'websearch', config: TSV_CONFIG })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (tsError) throw new BadRequestException(tsError.message);

    if ((tsCount ?? 0) > 0) {
      return {
        items: (tsData ?? []) as ProductRow[],
        total: tsCount ?? 0,
        page,
        limit,
      };
    }

    // Fallback: ilike on name/brand for partial or no-tsv matches.
    const pattern = `%${q.replace(/[%_]/g, (m) => `\\${m}`)}%`;
    const {
      data: ilData,
      error: ilError,
      count: ilCount,
    } = await this.supabase.client
      .from('products')
      .select('*', { count: 'exact' })
      .eq('is_active', true)
      .or(`name.ilike.${pattern},brand.ilike.${pattern}`)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (ilError) throw new BadRequestException(ilError.message);

    return {
      items: (ilData ?? []) as ProductRow[],
      total: ilCount ?? 0,
      page,
      limit,
    };
  }

  /**
   * Single active product by slug. Throws `NotFoundException` if it is missing
   * or inactive.
   */
  async findBySlug(slug: string): Promise<ProductRow> {
    const { data, error } = await this.supabase.client
      .from('products')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle();

    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException(`Product "${slug}" not found`);
    return data as ProductRow;
  }

  /**
   * Up to 8 active products in the same category as the given product,
   * excluding the product itself.
   */
  async related(id: string): Promise<ProductRow[]> {
    const { data: self, error: selfError } = await this.supabase.client
      .from('products')
      .select('id, category_id')
      .eq('id', id)
      .maybeSingle();

    if (selfError) throw new BadRequestException(selfError.message);
    if (!self) throw new NotFoundException(`Product "${id}" not found`);

    const categoryId = (self as { category_id: string | null }).category_id;
    if (!categoryId) return [];

    const { data, error } = await this.supabase.client
      .from('products')
      .select('*')
      .eq('is_active', true)
      .eq('category_id', categoryId)
      .neq('id', id)
      .order('created_at', { ascending: false })
      .limit(8);

    if (error) throw new BadRequestException(error.message);
    return (data ?? []) as ProductRow[];
  }

  /** Create a product (admin). */
  async create(dto: CreateProductDto): Promise<ProductRow> {
    const { data, error } = await this.supabase.client
      .from('products')
      .insert(dto)
      .select('*')
      .single();

    if (error) throw new BadRequestException(error.message);
    return data as ProductRow;
  }

  /** Patch a product (admin). Throws if the product does not exist. */
  async update(id: string, dto: UpdateProductDto): Promise<ProductRow> {
    const { data, error } = await this.supabase.client
      .from('products')
      .update(dto)
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException(`Product "${id}" not found`);
    return data as ProductRow;
  }

  /**
   * Soft-delete a product by flipping `is_active` to false (the table has an
   * `is_active` column, so we never hard-delete and lose order-item history).
   */
  async remove(id: string): Promise<{ id: string; is_active: boolean }> {
    const { data, error } = await this.supabase.client
      .from('products')
      .update({ is_active: false })
      .eq('id', id)
      .select('id, is_active')
      .maybeSingle();

    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException(`Product "${id}" not found`);
    return data as { id: string; is_active: boolean };
  }

  /**
   * Upload an image to the `product-images` bucket, append its public URL to
   * the product's `images` array, and return the persisted product plus URL.
   */
  async addImage(
    id: string,
    file: UploadedImage,
  ): Promise<{ url: string; product: ProductRow }> {
    if (!file?.buffer) {
      throw new BadRequestException('No image file provided');
    }

    // Confirm the product exists and grab its current images.
    const { data: existing, error: fetchError } = await this.supabase.client
      .from('products')
      .select('id, images')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) throw new BadRequestException(fetchError.message);
    if (!existing) throw new NotFoundException(`Product "${id}" not found`);

    const ext = this.extensionFor(file.originalname, file.mimetype);
    const objectPath = `${id}/${Date.now()}-${this.randomToken()}${ext}`;

    const { error: uploadError } = await this.supabase.client.storage
      .from(PRODUCT_IMAGES_BUCKET)
      .upload(objectPath, file.buffer, {
        contentType: file.mimetype || 'application/octet-stream',
        upsert: false,
      });

    if (uploadError) throw new BadRequestException(uploadError.message);

    const {
      data: { publicUrl },
    } = this.supabase.client.storage
      .from(PRODUCT_IMAGES_BUCKET)
      .getPublicUrl(objectPath);

    const currentImages =
      ((existing as { images: string[] | null }).images ?? []) as string[];
    const nextImages = [...currentImages, publicUrl];

    const { data: updated, error: updateError } = await this.supabase.client
      .from('products')
      .update({ images: nextImages })
      .eq('id', id)
      .select('*')
      .single();

    if (updateError) throw new BadRequestException(updateError.message);

    return { url: publicUrl, product: updated as ProductRow };
  }

  /** Resolve a category reference (slug or UUID) to its id, or null. */
  private async resolveCategoryId(ref: string): Promise<string | null> {
    if (UUID_RE.test(ref)) return ref;

    const { data, error } = await this.supabase.client
      .from('categories')
      .select('id')
      .eq('slug', ref)
      .maybeSingle();

    if (error) throw new BadRequestException(error.message);
    return data ? (data as { id: string }).id : null;
  }

  /** Pick a file extension from the original name, falling back to mimetype. */
  private extensionFor(originalName: string, mimetype: string): string {
    const fromName = originalName?.includes('.')
      ? `.${originalName.split('.').pop()?.toLowerCase()}`
      : '';
    if (fromName && fromName.length <= 6) return fromName;

    const map: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
      'image/avif': '.avif',
    };
    return map[mimetype] ?? '';
  }

  /** Short random token to avoid filename collisions within a product folder. */
  private randomToken(): string {
    return Math.random().toString(36).slice(2, 10);
  }
}

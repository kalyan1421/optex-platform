import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public, Roles } from '../../auth/decorators';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { SearchQueryDto } from './dto/search-query.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Paginated, ProductRow, ProductsService, UploadedImage } from './products.service';

/**
 * Product catalog endpoints. Reads are public; writes require `super_admin`.
 * Mounted at `/api/products` (global `api` prefix applied in `main.ts`).
 *
 * Route ordering note: the static `/search` route is declared before the
 * `/:slug` param route so it is not shadowed by slug matching.
 */
/**
 * Ceiling for PUBLIC CATALOGUE READS, per caller, per minute.
 *
 * Much higher than the global 300 (F-01), and the load tests are why. Running
 * `load/browse.js` at 50 concurrent shoppers rate-limited 16% of requests: all
 * of them anonymous, all from one address, all sharing a bucket. That is not an
 * artefact of the test rig — it is the norm on Kenyan mobile networks, where
 * carrier-grade NAT puts thousands of real customers behind a handful of
 * addresses. The bearer-token keying in `UserAwareThrottlerGuard` fixes this for
 * signed-in users; anonymous browsers have no token to key on, so IP is all
 * there is and IP is a poor proxy for identity here.
 *
 * A high ceiling is safe on exactly these routes because they are cheap and
 * cacheable — active-only reads with a paginated `select`, fronted by Next's
 * revalidation. The expensive and abusable endpoints keep the tighter limits:
 * search has its own (below), credentials sit at 10/min, and everything that
 * writes stays on the global 300.
 */
const CATALOGUE_READ_LIMIT = Number(process.env.CATALOGUE_RATE_LIMIT ?? 2000);

/**
 * Search is deliberately lower than the rest of the catalogue: it runs
 * `websearch_to_tsquery` with an `ilike` fallback, which is the most expensive
 * public query in the API and the one F-19 capped the input length of.
 */
const SEARCH_LIMIT = Number(process.env.SEARCH_RATE_LIMIT ?? 600);

@ApiTags('catalog')
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Throttle({ default: { ttl: 60_000, limit: CATALOGUE_READ_LIMIT } })
  @Public()
  @Get()
  @ApiOperation({ summary: 'List products (paginated, filterable)' })
  @ApiOkResponse({ description: 'Paginated active products' })
  list(@Query() query: ProductQueryDto): Promise<Paginated<ProductRow>> {
    return this.products.list(query);
  }

  /**
   * Admin listing: every product, active or not (gap G-2). Declared before the
   * `:slug` route so "admin" is not swallowed as a slug. Separate from the
   * public route rather than a flag on it — a `@Public()` endpoint must not
   * conditionally widen its result set based on a token it never verifies.
   */
  @Roles('super_admin')
  @ApiBearerAuth()
  @Get('admin/all')
  @ApiOperation({ summary: 'List all products including inactive (admin)' })
  @ApiOkResponse({ description: 'Paginated products, active and inactive' })
  listAllForAdmin(@Query() query: ProductQueryDto): Promise<Paginated<ProductRow>> {
    return this.products.listForAdmin(query);
  }

  @Throttle({ default: { ttl: 60_000, limit: SEARCH_LIMIT } })
  @Public()
  @Get('search')
  @ApiOperation({ summary: 'Full-text search products' })
  @ApiOkResponse({ description: 'Paginated search results' })
  search(@Query() query: SearchQueryDto): Promise<Paginated<ProductRow>> {
    return this.products.search(query);
  }

  @Throttle({ default: { ttl: 60_000, limit: CATALOGUE_READ_LIMIT } })
  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Get a single active product by slug' })
  @ApiOkResponse({ description: 'The product' })
  findBySlug(@Param('slug') slug: string): Promise<ProductRow> {
    return this.products.findBySlug(slug);
  }

  @Throttle({ default: { ttl: 60_000, limit: CATALOGUE_READ_LIMIT } })
  @Public()
  @Get(':id/related')
  @ApiOperation({ summary: 'Related products in the same category (max 8)' })
  @ApiOkResponse({ description: 'Up to 8 related products' })
  related(@Param('id', new ParseUUIDPipe()) id: string): Promise<ProductRow[]> {
    return this.products.related(id);
  }

  @Roles('super_admin')
  @Post()
  @ApiOperation({ summary: 'Create a product (admin)' })
  @ApiCreatedResponse({ description: 'The created product' })
  create(@Body() dto: CreateProductDto): Promise<ProductRow> {
    return this.products.create(dto);
  }

  @Roles('super_admin')
  @Patch(':id')
  @ApiOperation({ summary: 'Update a product (admin)' })
  @ApiOkResponse({ description: 'The updated product' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateProductDto,
  ): Promise<ProductRow> {
    return this.products.update(id, dto);
  }

  @Roles('super_admin')
  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete (deactivate) a product (admin)' })
  @ApiOkResponse({ description: 'The deactivated product id/state' })
  remove(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<{ id: string; is_active: boolean }> {
    return this.products.remove(id);
  }

  @Roles('super_admin')
  @Post(':id/images')
  @ApiOperation({ summary: 'Upload a product image (admin)' })
  @ApiConsumes('multipart/form-data')
  @ApiCreatedResponse({ description: 'Public URL + updated product' })
  @UseInterceptors(FileInterceptor('file'))
  addImage(
    @Param('id', new ParseUUIDPipe()) id: string,
    @UploadedFile() file: UploadedImage,
  ): Promise<{ url: string; product: ProductRow }> {
    return this.products.addImage(id, file);
  }
}

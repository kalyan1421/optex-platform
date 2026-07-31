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
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
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
@ApiTags('catalog')
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List products (paginated, filterable)' })
  @ApiOkResponse({ description: 'Paginated active products' })
  list(@Query() query: ProductQueryDto): Promise<Paginated<ProductRow>> {
    return this.products.list(query);
  }

  @Public()
  @Get('search')
  @ApiOperation({ summary: 'Full-text search products' })
  @ApiOkResponse({ description: 'Paginated search results' })
  search(@Query() query: SearchQueryDto): Promise<Paginated<ProductRow>> {
    return this.products.search(query);
  }

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Get a single active product by slug' })
  @ApiOkResponse({ description: 'The product' })
  findBySlug(@Param('slug') slug: string): Promise<ProductRow> {
    return this.products.findBySlug(slug);
  }

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

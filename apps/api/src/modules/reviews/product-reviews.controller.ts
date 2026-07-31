import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Public, CurrentUser } from '../../auth/decorators';
import type { AuthUser } from '../../auth/auth-user';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { ProductReviewsResponseDto, ReviewDto } from './dto/review.dto';

/**
 * Public + customer-facing product reviews. Mounted at
 * `/api/products/:productId/reviews` (global prefix applied in `main.ts`).
 *
 * - `GET` is `@Public()` and returns only approved reviews + an aggregate.
 * - `POST` requires a valid JWT; the review is attributed to the caller's
 *   `customers` row and held as `pending` for moderation.
 */
@ApiTags('reviews')
@Controller('products/:productId/reviews')
export class ProductReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List approved reviews for a product' })
  @ApiParam({ name: 'productId', format: 'uuid' })
  @ApiOkResponse({
    type: ProductReviewsResponseDto,
    description: 'Approved reviews and rating aggregate',
  })
  list(@Param('productId', ParseUUIDPipe) productId: string): Promise<ProductReviewsResponseDto> {
    return this.reviews.listApprovedForProduct(productId);
  }

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a review for a product' })
  @ApiParam({ name: 'productId', format: 'uuid' })
  @ApiCreatedResponse({
    type: ReviewDto,
    description: 'The created review (pending moderation)',
  })
  create(
    @CurrentUser() user: AuthUser,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: CreateReviewDto,
  ): Promise<ReviewDto> {
    return this.reviews.createForProduct(user, productId, dto);
  }
}

import { ApiProperty } from '@nestjs/swagger';

/**
 * The `review_status` enum values, mirrored from `0001_init_schema.sql`
 * (`review_status: 'pending' | 'approved' | 'flagged'`). The schema default is
 * `'pending'`.
 */
export const REVIEW_STATUSES = ['pending', 'approved', 'flagged'] as const;

/** Union of the `review_status` enum values. */
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

/** The pending status applied to newly created reviews (schema default). */
export const DEFAULT_REVIEW_STATUS: ReviewStatus = 'pending';

/**
 * A single `product_reviews` row, shaped for API responses. Columns mirror the
 * schema exactly: `id, product_id, customer_id, rating, body, status,
 * admin_reply, created_at` (there is no `title` column).
 */
export class ReviewDto {
  @ApiProperty({ description: 'Review id (uuid).', format: 'uuid' })
  id!: string;

  @ApiProperty({ description: 'Product the review belongs to.', format: 'uuid' })
  product_id!: string;

  @ApiProperty({ description: 'Authoring customer id.', format: 'uuid' })
  customer_id!: string;

  @ApiProperty({ description: 'Star rating 1–5.', minimum: 1, maximum: 5 })
  rating!: number;

  @ApiProperty({ description: 'Review body text.', nullable: true })
  body!: string | null;

  @ApiProperty({
    description: 'Moderation status.',
    enum: REVIEW_STATUSES,
  })
  status!: ReviewStatus;

  @ApiProperty({ description: 'Public admin reply, if any.', nullable: true })
  admin_reply!: string | null;

  @ApiProperty({ description: 'Creation timestamp (ISO 8601).' })
  created_at!: string;
}

/** Aggregate rating summary returned alongside a product's review list. */
export class ReviewAggregateDto {
  @ApiProperty({
    description: 'Mean rating across approved reviews, or null when none.',
    nullable: true,
    example: 4.5,
  })
  averageRating!: number | null;

  @ApiProperty({ description: 'Count of approved reviews.', example: 12 })
  count!: number;
}

/** Public response for `GET /products/:productId/reviews`. */
export class ProductReviewsResponseDto {
  @ApiProperty({ type: [ReviewDto], description: 'Approved reviews.' })
  reviews!: ReviewDto[];

  @ApiProperty({ type: ReviewAggregateDto, description: 'Rating aggregate.' })
  aggregate!: ReviewAggregateDto;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

/**
 * Body for `POST /products/:productId/reviews`.
 *
 * NOTE: the `product_reviews` table has no `title` column (see
 * `0001_init_schema.sql`). `title` is accepted for forward-compatibility with
 * the API contract but is NOT persisted — it is silently dropped by the
 * service. Only `rating` and `body` map to columns.
 */
export class CreateReviewDto {
  @ApiProperty({
    description: 'Star rating from 1 to 5.',
    minimum: 1,
    maximum: 5,
    example: 5,
  })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiPropertyOptional({
    description:
      'Optional review title. Accepted but not persisted — the schema has no title column.',
    maxLength: 160,
    example: 'Excellent fit and clarity',
  })
  @IsOptional()
  @IsString()
  @Length(1, 160)
  title?: string;

  @ApiPropertyOptional({
    description: 'Free-text review body.',
    maxLength: 2000,
    example: 'These frames are lightweight and the lenses are crystal clear.',
  })
  @IsOptional()
  @IsString()
  @Length(1, 2000)
  body?: string;
}

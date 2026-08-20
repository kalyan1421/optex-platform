import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
} from 'class-validator';

/**
 * Body for `POST /admin/promo-banners`. Field names mirror the `promo_banners`
 * columns exactly so the service can pass the DTO straight to an insert.
 */
export class CreatePromoBannerDto {
  @ApiProperty({
    description: 'Banner image URL (object in the promo-banners storage bucket).',
    example: 'https://cdn.optex.co.ke/promo-banners/winter-sale.jpg',
  })
  @IsString()
  @Length(1, 2048)
  image_url!: string;

  @ApiPropertyOptional({
    description: 'Destination URL when the banner is clicked.',
    example: 'https://optex.co.ke/shop?promo=WELCOME10',
  })
  @IsOptional()
  @IsString()
  @Length(1, 2048)
  // Banners may link to an internal storefront path (`/shop`) or to an
  // external HTTPS endpoint. Reject javascript/data URLs before they reach
  // the client-side Link renderer.
  @Matches(/^(?:https?:\/\/\S+|\/(?!\/)(?:\S*))$/i, {
    message: 'target_url must be a relative path or an http(s) URL',
  })
  target_url?: string;

  @ApiPropertyOptional({
    description: 'Headline text overlaid on the banner.',
    example: 'Winter Sale — up to 30% off',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  headline?: string;

  @ApiPropertyOptional({
    description: 'ISO timestamp before which the banner is not shown.',
    example: '2026-07-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  starts_at?: string;

  @ApiPropertyOptional({
    description: 'ISO timestamp after which the banner stops showing.',
    example: '2026-08-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  ends_at?: string;

  @ApiPropertyOptional({
    description: 'Whether the banner is active. Defaults to true.',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({
    description: 'Sort order for stacking banners (ascending). Defaults to 0.',
    example: 0,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  sort_order?: number;
}

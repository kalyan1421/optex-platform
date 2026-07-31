import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/** Which provider's transactions to include in the unified admin list. */
export enum PaymentProviderFilter {
  MPESA = 'mpesa',
  PESAPAL = 'pesapal',
}

/**
 * Query for `GET /api/admin/payments` — unified list of M-Pesa + Pesapal
 * transactions with optional filters and pagination.
 */
export class AdminListPaymentsQueryDto {
  @ApiPropertyOptional({
    enum: PaymentProviderFilter,
    description: 'Restrict to a single provider (default: both, merged)',
  })
  @IsEnum(PaymentProviderFilter)
  @IsOptional()
  provider?: PaymentProviderFilter;

  @ApiPropertyOptional({
    description: 'Transaction status filter (pending | matched | failed | reversed)',
  })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({
    description: 'Filter to transactions for a single order id (uuid)',
  })
  @IsString()
  @IsOptional()
  orderId?: string;

  @ApiPropertyOptional({ description: 'Page number (1-based)', default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Page size',
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  pageSize?: number = 20;
}

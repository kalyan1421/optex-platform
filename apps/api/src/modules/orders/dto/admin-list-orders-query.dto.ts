import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * All values of the `order_status` Postgres enum
 * (`Backend/supabase/migrations/0001_init_schema.sql`).
 */
export enum OrderStatus {
  PENDING_PAYMENT = 'pending_payment',
  RECEIVED = 'received',
  PROCESSING = 'processing',
  DISPATCHED = 'dispatched',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
}

/** All values of the `payment_status` Postgres enum. */
export enum PaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

/** All values of the `payment_method` Postgres enum. */
export enum PaymentMethod {
  MPESA = 'mpesa',
  PESAPAL = 'pesapal',
  COD = 'cod',
}

/**
 * Query for `GET /admin/orders` — admin order list with optional status /
 * payment-status filters and pagination.
 */
export class AdminListOrdersQueryDto {
  @ApiPropertyOptional({
    enum: OrderStatus,
    description: 'Filter by fulfilment status',
  })
  @IsEnum(OrderStatus)
  @IsOptional()
  status?: OrderStatus;

  @ApiPropertyOptional({
    enum: PaymentStatus,
    description: 'Filter by payment status',
  })
  @IsEnum(PaymentStatus)
  @IsOptional()
  paymentStatus?: PaymentStatus;

  @ApiPropertyOptional({
    enum: PaymentMethod,
    description: 'Filter by payment method (e.g. cod)',
  })
  @IsEnum(PaymentMethod)
  @IsOptional()
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({
    description: 'Page number (1-based)',
    default: 1,
    minimum: 1,
  })
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

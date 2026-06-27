import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { OrderStatus } from './admin-list-orders-query.dto';

/**
 * Body for `PATCH /admin/orders/:id/status`. The admin moves an order through
 * the fulfilment workflow. The target status is validated against the
 * `order_status` enum; the service additionally enforces a legal transition
 * (e.g. you cannot un-deliver a delivered order).
 */
export class AdminOrderStatusDto {
  @ApiProperty({
    enum: OrderStatus,
    description: 'New fulfilment status for the order',
    example: OrderStatus.PROCESSING,
  })
  @IsEnum(OrderStatus)
  status!: OrderStatus;

  @ApiPropertyOptional({
    description: 'Optional internal note appended to the order',
    example: 'Customer requested gift wrap',
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  note?: string;
}

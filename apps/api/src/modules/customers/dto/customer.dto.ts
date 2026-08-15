import { ApiProperty } from '@nestjs/swagger';

/**
 * A customer's order as embedded in the admin customer list. Only the fields
 * the admin table renders (totals, status, order number) — not the full order.
 */
export class CustomerOrderSummaryDto {
  @ApiProperty({ description: 'Order id (uuid).', format: 'uuid' })
  id!: string;

  @ApiProperty({ description: 'Human-readable order number, e.g. OPX-2026-000123.' })
  order_number!: string;

  @ApiProperty({ description: 'Order total in KES.' })
  total_kes!: number;

  @ApiProperty({ description: 'Order status.' })
  status!: string;
}

/**
 * A `customers` row with its orders embedded, shaped for the admin customer
 * table. Columns mirror the schema exactly.
 */
export class AdminCustomerDto {
  @ApiProperty({ description: 'Customer id (uuid).', format: 'uuid' })
  id!: string;

  @ApiProperty({ description: 'Full name.', nullable: true })
  full_name!: string | null;

  @ApiProperty({ description: 'Email address.', nullable: true })
  email!: string | null;

  @ApiProperty({ description: 'Phone number.', nullable: true })
  phone!: string | null;

  @ApiProperty({ description: 'Signup timestamp (ISO 8601).' })
  created_at!: string;

  @ApiProperty({
    description: 'When an admin deactivated this account, or null if active.',
    nullable: true,
  })
  deactivated_at!: string | null;

  @ApiProperty({
    type: [CustomerOrderSummaryDto],
    description: "The customer's orders, newest first.",
  })
  orders!: CustomerOrderSummaryDto[];
}

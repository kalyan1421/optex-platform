import { ApiProperty } from '@nestjs/swagger';

export class SerialLedgerEntryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  serial_id!: string;

  @ApiProperty({
    enum: [
      'received',
      'transfer_out',
      'transfer_in',
      'sold',
      'sale_reversed',
      'adjusted_out',
      'found',
      'count_variance',
    ],
  })
  movement_type!: string;

  @ApiProperty({ nullable: true, format: 'uuid' })
  from_branch_id!: string | null;

  @ApiProperty({ nullable: true, format: 'uuid' })
  to_branch_id!: string | null;

  @ApiProperty()
  reference_type!: string;

  @ApiProperty({ nullable: true, format: 'uuid' })
  reference_id!: string | null;

  @ApiProperty({ nullable: true, format: 'uuid' })
  actor_user_id!: string | null;

  @ApiProperty({ nullable: true })
  actor_role!: string | null;

  @ApiProperty()
  created_at!: string;
}

export class SerialHistoryDto {
  @ApiProperty({ format: 'uuid' })
  serial_id!: string;

  @ApiProperty()
  serial_number!: string;

  @ApiProperty({ format: 'uuid' })
  product_id!: string;

  @ApiProperty()
  product_name!: string;

  @ApiProperty({ nullable: true })
  current_status!: string | null;

  @ApiProperty({ nullable: true, format: 'uuid' })
  current_branch_id!: string | null;

  @ApiProperty({ type: [SerialLedgerEntryDto] })
  movements!: SerialLedgerEntryDto[];
}

/**
 * One in-stock unit, for pickers that must name specific serials.
 *
 * A transfer moves `serial_ids`, and an adjustment removes one, so the admin
 * UI has to be able to see which units are actually on a branch's shelf.
 * Every other serial view is either a single-serial trace or an aging report,
 * neither of which answers "what can I move from here right now".
 */
export class InventorySerialDto {
  @ApiProperty({ format: 'uuid' })
  serial_id!: string;

  @ApiProperty()
  serial_number!: string;

  @ApiProperty({ format: 'uuid' })
  product_id!: string;

  @ApiProperty()
  product_name!: string;

  @ApiProperty({ nullable: true })
  product_sku!: string | null;

  @ApiProperty({ format: 'uuid', nullable: true })
  branch_id!: string | null;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  received_at!: string;

  @ApiProperty({ nullable: true })
  cost_price_kes!: number | null;
}

export class AgingSerialDto {
  @ApiProperty({ format: 'uuid' })
  serial_id!: string;

  @ApiProperty()
  serial_number!: string;

  @ApiProperty({ format: 'uuid' })
  product_id!: string;

  @ApiProperty()
  product_name!: string;

  @ApiProperty({ format: 'uuid' })
  branch_id!: string;

  @ApiProperty()
  received_at!: string;

  @ApiProperty({ description: 'Whole days from receipt to now (UTC).' })
  days_on_shelf!: number;

  @ApiProperty({ nullable: true })
  cost_price_kes!: number | null;
}

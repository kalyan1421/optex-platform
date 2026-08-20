import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class DispatchTransferDto {
  @ApiProperty({ description: 'Branch the serials are leaving.', format: 'uuid' })
  @IsUUID()
  from_branch_id!: string;

  @ApiProperty({ description: 'Branch the serials are going to.', format: 'uuid' })
  @IsUUID()
  to_branch_id!: string;

  @ApiProperty({ type: [String], description: 'Serials being transferred — must be in_stock at from_branch_id.' })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  serial_ids!: string[];

  @ApiProperty({ description: 'Free-text notes.', required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ReceiveTransferLostItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  serial_id!: string;

  @ApiProperty({ description: 'One of stock_adjustment_reasons.id.' })
  @IsString()
  reason_code!: string;
}

/**
 * Body for receiving a transfer. Every serial in `received` or `lost` must be
 * a still-`in_transit` line on this transfer — anything else is silently
 * skipped by `receive_transfer` (migration 0027), not an error, so a repeat
 * or partial call can't double-resolve a line. Both arrays may be empty (a
 * receive call that only reports losses, or only confirms arrivals).
 */
export class ReceiveTransferDto {
  @ApiProperty({ type: [String], description: 'Serials that physically arrived.', required: false })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  received?: string[];

  @ApiProperty({ type: [ReceiveTransferLostItemDto], description: 'Serials that did not arrive, with a reason.', required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceiveTransferLostItemDto)
  lost?: ReceiveTransferLostItemDto[];
}

export class TransferItemDto {
  @ApiProperty({ format: 'uuid' })
  serial_id!: string;

  @ApiProperty()
  serial_number!: string;

  @ApiProperty({ nullable: true })
  product_name!: string | null;

  @ApiProperty({ enum: ['in_transit', 'received', 'lost'] })
  status!: 'in_transit' | 'received' | 'lost';
}

export class TransferDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  transfer_number!: string;

  @ApiProperty({ format: 'uuid' })
  from_branch_id!: string;

  @ApiProperty({ format: 'uuid' })
  to_branch_id!: string;

  @ApiProperty({ enum: ['pending', 'in_transit', 'received', 'cancelled'] })
  status!: 'pending' | 'in_transit' | 'received' | 'cancelled';

  @ApiProperty({ nullable: true })
  notes!: string | null;

  @ApiProperty({ nullable: true })
  dispatched_at!: string | null;

  @ApiProperty({ nullable: true })
  received_at!: string | null;

  @ApiProperty({ type: [TransferItemDto] })
  items!: TransferItemDto[];
}

import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsInt, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateGrnItemDto {
  @ApiProperty({ description: 'Product this line receives stock for.', format: 'uuid' })
  @IsUUID()
  product_id!: string;

  @ApiProperty({ description: 'Actual cost paid per unit, in KES. Used for FIFO valuation.', minimum: 0 })
  @IsInt()
  @Min(0)
  unit_cost_kes!: number;

  @ApiProperty({ description: 'Units expected on this line.', minimum: 1 })
  @IsInt()
  @Min(1)
  quantity_ordered!: number;
}

export class CreateGrnDto {
  @ApiProperty({ description: 'Supplier goods are being received from.', format: 'uuid' })
  @IsUUID()
  supplier_id!: string;

  @ApiProperty({ description: 'Branch receiving the goods.', format: 'uuid' })
  @IsUUID()
  branch_id!: string;

  @ApiProperty({ description: 'Free-text notes.', required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: [CreateGrnItemDto], description: 'Lines — one per product on this GRN.' })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateGrnItemDto)
  items!: CreateGrnItemDto[];
}

/** Replaces every line on a still-draft GRN. */
export class UpdateGrnItemsDto {
  @ApiProperty({ type: [CreateGrnItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateGrnItemDto)
  items!: CreateGrnItemDto[];
}

export class PostGrnSerialDto {
  @ApiProperty({ description: 'The GRN line this serial belongs to.', format: 'uuid' })
  @IsUUID()
  grn_item_id!: string;

  @ApiProperty({ description: 'The physical serial/frame number.' })
  @IsString()
  serial_number!: string;
}

/**
 * Body for posting a GRN — the flattened list of every serial received across
 * every line. NestJS validates the submitted count per line against
 * `quantity_ordered` before calling `post_grn` (the RPC itself does not
 * re-check this — it trusts the caller has already reconciled counts, same
 * division of labour as `place_order`'s pre-flight availability check versus
 * `deduct_stock_fifo`'s hard stock guarantee).
 */
export class PostGrnDto {
  @ApiProperty({ type: [PostGrnSerialDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PostGrnSerialDto)
  serials!: PostGrnSerialDto[];
}

export class GrnItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  product_id!: string;

  @ApiProperty({ nullable: true })
  product_name!: string | null;

  @ApiProperty({ nullable: true })
  product_sku!: string | null;

  @ApiProperty()
  unit_cost_kes!: number;

  @ApiProperty()
  quantity_ordered!: number;
}

export class GrnDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  grn_number!: string;

  @ApiProperty({ format: 'uuid' })
  supplier_id!: string;

  @ApiProperty({ format: 'uuid' })
  branch_id!: string;

  @ApiProperty({ enum: ['draft', 'posted'] })
  status!: 'draft' | 'posted';

  @ApiProperty({ nullable: true })
  notes!: string | null;

  @ApiProperty()
  created_at!: string;

  @ApiProperty({ nullable: true })
  posted_at!: string | null;

  @ApiProperty({ type: [GrnItemDto] })
  items!: GrnItemDto[];
}

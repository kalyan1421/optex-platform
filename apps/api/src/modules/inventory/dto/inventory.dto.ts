import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsUUID, Max, Min } from 'class-validator';

/** A branch the inventory grid has columns for. */
export class InventoryBranchDto {
  @ApiProperty({ description: 'Branch id (uuid).', format: 'uuid' })
  id!: string;

  @ApiProperty({ description: 'Branch name.' })
  name!: string;
}

/** The product an inventory row belongs to, with its category name. */
export class InventoryProductDto {
  @ApiProperty({ description: 'Product id (uuid).', format: 'uuid' })
  id!: string;

  @ApiProperty({ description: 'Product name.' })
  name!: string;

  @ApiProperty({ description: 'Stock-keeping unit.' })
  sku!: string;

  @ApiProperty({ description: 'Category name, when the product has one.', nullable: true })
  category_name!: string | null;
}

/** One `inventory` row: stock of a product at a branch. */
export class InventoryItemDto {
  @ApiProperty({ description: 'Product id (uuid).', format: 'uuid' })
  product_id!: string;

  @ApiProperty({ description: 'Branch id (uuid).', format: 'uuid' })
  branch_id!: string;

  @ApiProperty({ description: 'Units in stock at this branch.' })
  stock!: number;

  @ApiProperty({ type: InventoryProductDto, description: 'The product.' })
  product!: InventoryProductDto;
}

/** Response for `GET /admin/inventory` — the grid plus its branch columns. */
export class InventoryResponseDto {
  @ApiProperty({ type: [InventoryBranchDto], description: 'Active branches.' })
  branches!: InventoryBranchDto[];

  @ApiProperty({ type: [InventoryItemDto], description: 'Per-product, per-branch stock.' })
  items!: InventoryItemDto[];
}

/**
 * Body for `PATCH /admin/inventory`. `inventory` is keyed on the composite
 * (product_id, branch_id) rather than a surrogate id, so both are required to
 * identify the row.
 */
export class UpdateStockDto {
  @ApiProperty({ description: 'Product to adjust.', format: 'uuid' })
  @IsUUID()
  product_id!: string;

  @ApiProperty({ description: 'Branch to adjust it at.', format: 'uuid' })
  @IsUUID()
  branch_id!: string;

  @ApiProperty({ description: 'New stock level. Non-negative.', minimum: 0, maximum: 1_000_000 })
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  stock!: number;
}

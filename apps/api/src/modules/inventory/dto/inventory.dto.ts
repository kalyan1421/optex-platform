import { ApiProperty } from '@nestjs/swagger';

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

/** One product/branch comparison of the stock cache to the serial projection. */
export class InventoryReconciliationItemDto {
  @ApiProperty({ format: 'uuid' })
  product_id!: string;

  @ApiProperty()
  product_name!: string;

  @ApiProperty()
  product_sku!: string;

  @ApiProperty({ format: 'uuid' })
  branch_id!: string;

  @ApiProperty()
  branch_name!: string;

  @ApiProperty()
  cached_stock!: number;

  @ApiProperty()
  serial_stock!: number;

  @ApiProperty({ description: 'cached_stock minus serial_stock; zero is reconciled.' })
  difference!: number;
}

export class InventoryReconciliationResponseDto {
  @ApiProperty({ type: [InventoryReconciliationItemDto] })
  items!: InventoryReconciliationItemDto[];

  @ApiProperty({ description: 'True only when every product/branch cache matches its in-stock serial count.' })
  reconciled!: boolean;
}

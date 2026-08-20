import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class StartStockCountDto {
  @ApiProperty({ description: 'Branch being counted.', format: 'uuid' })
  @IsUUID()
  branch_id!: string;
}

export class ScanItemDto {
  @ApiProperty({ description: 'The literal serial number scanned.' })
  @IsString()
  serial_number!: string;

  @ApiProperty({
    description: 'Required only when this serial matches no existing product_serials row — the counter must say what product it is.',
    required: false,
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  product_id?: string;
}

export class ScanStockCountDto {
  @ApiProperty({ type: [ScanItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ScanItemDto)
  scans!: ScanItemDto[];
}

export class StockCountItemDto {
  @ApiProperty({ nullable: true, format: 'uuid' })
  serial_id!: string | null;

  @ApiProperty({ nullable: true })
  scanned_serial_number!: string | null;

  @ApiProperty({ nullable: true, format: 'uuid' })
  product_id!: string | null;

  @ApiProperty({ nullable: true })
  product_name!: string | null;

  @ApiProperty()
  expected!: boolean;

  @ApiProperty()
  found!: boolean;
}

export class StockCountDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  branch_id!: string;

  @ApiProperty({ enum: ['in_progress', 'completed', 'cancelled'] })
  status!: 'in_progress' | 'completed' | 'cancelled';

  @ApiProperty()
  started_at!: string;

  @ApiProperty({ nullable: true })
  completed_at!: string | null;

  @ApiProperty({ type: [StockCountItemDto] })
  items!: StockCountItemDto[];
}

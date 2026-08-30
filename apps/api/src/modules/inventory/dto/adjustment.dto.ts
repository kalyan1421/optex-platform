import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AdjustmentItemDto {
  @ApiProperty({ enum: ['add', 'remove'] })
  @IsIn(['add', 'remove'])
  direction!: 'add' | 'remove';

  @ApiProperty({
    description: "Required when direction is 'remove' — the specific unit being written off.",
    required: false,
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  serial_id?: string;

  @ApiProperty({
    description: "Required when direction is 'add' — the product a newly-found unit belongs to.",
    required: false,
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  product_id?: string;

  @ApiProperty({ description: 'One of stock_adjustment_reasons.id.' })
  @IsString()
  reason_code!: string;
}

export class CreateAdjustmentDto {
  @ApiProperty({ description: 'Branch this adjustment is being made at.', format: 'uuid' })
  @IsUUID()
  branch_id!: string;

  @ApiProperty({ description: 'Free-text notes.', required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: [AdjustmentItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AdjustmentItemDto)
  items!: AdjustmentItemDto[];
}

export class AdjustmentReasonDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  description!: string;
}

export class AdjustmentLineDto {
  @ApiProperty({ nullable: true, format: 'uuid' })
  serial_id!: string | null;

  @ApiProperty({ nullable: true, format: 'uuid' })
  product_id!: string | null;

  @ApiProperty({ nullable: true })
  product_name!: string | null;

  @ApiProperty()
  reason_code!: string;

  @ApiProperty({ enum: ['add', 'remove'] })
  direction!: 'add' | 'remove';
}

export class AdjustmentDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  branch_id!: string;

  @ApiProperty({ nullable: true })
  notes!: string | null;

  @ApiProperty()
  created_at!: string;

  @ApiProperty({ type: [AdjustmentLineDto] })
  items!: AdjustmentLineDto[];
}

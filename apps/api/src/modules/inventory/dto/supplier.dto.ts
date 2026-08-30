import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

/** A row of the `suppliers` table (migration 0026). */
export class SupplierDto {
  @ApiProperty({ description: 'Supplier id (uuid).', format: 'uuid' })
  id!: string;

  @ApiProperty({ description: 'Supplier name.' })
  name!: string;

  @ApiProperty({ description: 'Primary contact name.', nullable: true })
  contact_name!: string | null;

  @ApiProperty({ description: 'Contact phone.', nullable: true })
  phone!: string | null;

  @ApiProperty({ description: 'Contact email.', nullable: true })
  email!: string | null;

  @ApiProperty({ description: 'Postal/physical address.', nullable: true })
  address!: string | null;

  @ApiProperty({ description: 'Whether this supplier can be selected on a new GRN.' })
  is_active!: boolean;

  @ApiProperty({ description: 'When this supplier was created.' })
  created_at!: string;
}

export class CreateSupplierDto {
  @ApiProperty({ description: 'Supplier name.' })
  @IsString()
  @MaxLength(200)
  name!: string;

  @ApiProperty({ description: 'Primary contact name.', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  contact_name?: string;

  @ApiProperty({ description: 'Contact phone.', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiProperty({ description: 'Contact email.', required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ description: 'Postal/physical address.', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;
}

export class UpdateSupplierDto {
  @ApiProperty({ description: 'Supplier name.', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiProperty({ description: 'Primary contact name.', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  contact_name?: string;

  @ApiProperty({ description: 'Contact phone.', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiProperty({ description: 'Contact email.', required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ description: 'Postal/physical address.', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiProperty({
    description:
      'Deactivate rather than delete — GRNs already received against this supplier keep referencing it.',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

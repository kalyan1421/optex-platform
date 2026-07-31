import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

/**
 * Admin list filter for prescriptions. `customerId` narrows the list to a
 * single customer's prescriptions (the `prescriptions.customer_id` value, i.e.
 * the `customers.id` PK — not the auth user id).
 */
export class PrescriptionQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by customers.id (the prescriptions.customer_id value)',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  customerId?: string;
}

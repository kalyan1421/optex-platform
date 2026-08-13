import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

/** Body for `PATCH /api/admin/cancellations/:id/approve`. */
export class ApproveCancellationDto {
  @ApiPropertyOptional({
    description:
      'Required when the order is already paid. Confirms the admin understands that cancelling does not refund the customer — client policy is "no refunds" (SPEC-06 R5).',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  acknowledgePaid?: boolean;
}

/** Body for `PATCH /api/admin/cancellations/:id/decline`. */
export class DeclineCancellationDto {
  @ApiPropertyOptional({
    description: 'Why the request was declined. Shown to the customer.',
    example: 'The frames have already been picked and packed.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

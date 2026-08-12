import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Body for `POST /api/orders/:id/cancellation`.
 *
 * The reason is optional by design (SPEC-06 R1) — requiring it would cost
 * requests from customers who just want the order stopped. When given it is
 * the highest-signal product feedback Optex gets for free, which is why R8
 * reports on it.
 */
export class RequestCancellationDto {
  @ApiPropertyOptional({
    description: 'Why the customer wants to cancel. Optional, free text.',
    example: 'Ordered the wrong frame size',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

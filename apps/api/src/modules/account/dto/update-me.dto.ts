import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, Matches } from 'class-validator';

/**
 * Body for `PATCH /me`. Only profile columns the customer is allowed to edit
 * are accepted; everything else (id, email, auth_user_id, created_at) is
 * server-controlled and silently stripped by the global `whitelist` pipe.
 */
export class UpdateMeDto {
  @ApiPropertyOptional({
    description: "Customer's full name.",
    example: 'Wanjiru Kamau',
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @Length(1, 120)
  full_name?: string;

  @ApiPropertyOptional({
    description: 'Contact phone in Kenyan format (e.g. +254712345678 or 0712345678).',
    example: '+254712345678',
  })
  @IsOptional()
  @IsString()
  @Matches(/^(\+?254|0)[17]\d{8}$/, {
    message: 'phone must be a valid Kenyan mobile number',
  })
  phone?: string;
}

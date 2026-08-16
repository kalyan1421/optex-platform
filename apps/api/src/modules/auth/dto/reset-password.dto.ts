import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

/**
 * Body for `POST /api/auth/reset-password`. The caller's identity comes from
 * the bearer token (the recovery session Supabase attaches to the reset-link
 * redirect), not from this body — there is no email or user id here.
 */
export class ResetPasswordDto {
  @ApiProperty({ example: 'a-new-strong-password', minLength: 6 })
  @IsString()
  @MinLength(6)
  password!: string;
}

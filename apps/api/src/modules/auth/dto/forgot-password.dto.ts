import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

/** Body for `POST /api/auth/forgot-password`. */
export class ForgotPasswordDto {
  @ApiProperty({ example: 'customer@example.com' })
  @IsEmail()
  email!: string;
}

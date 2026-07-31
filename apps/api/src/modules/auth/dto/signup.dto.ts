import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** Body for `POST /api/auth/signup`. */
export class SignupDto {
  @ApiProperty({ example: 'jane@example.com' })
  @IsEmail()
  email!: string;

  // bcrypt (GoTrue) caps the password at 72 bytes.
  @ApiProperty({ minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

  @ApiPropertyOptional({ example: 'Jane Wanjiku' })
  @IsString()
  @IsOptional()
  @MaxLength(120)
  fullName?: string;
}

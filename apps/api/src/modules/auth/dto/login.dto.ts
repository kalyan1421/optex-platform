import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

/** Body for `POST /api/auth/login`. */
export class LoginDto {
  @ApiProperty({ example: 'admin@optexopticians.co.ke' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Admin@Optex2025!' })
  @IsString()
  @MinLength(6)
  password!: string;
}

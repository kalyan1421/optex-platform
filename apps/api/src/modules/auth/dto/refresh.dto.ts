import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/** Body for `POST /api/auth/refresh`. */
export class RefreshDto {
  @ApiProperty({ description: 'The refresh token from a prior login/signup' })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

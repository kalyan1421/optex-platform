import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Payload for the public contact form. Validated with `class-validator`.
 */
export class ContactDto {
  @ApiProperty({ description: 'Sender full name', example: 'Jane Wanjiru' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiProperty({
    description: 'Sender email address',
    example: 'jane@example.com',
  })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({
    description: 'Sender phone number',
    example: '+254712345678',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional({
    description: 'Subject line',
    example: 'Question about prescription lenses',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @ApiProperty({
    description: 'Message body',
    example: 'I would like to know about your appointment availability.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  message!: string;
}

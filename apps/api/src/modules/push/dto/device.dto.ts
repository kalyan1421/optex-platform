import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  NOTIFICATION_CATEGORIES,
  type NotificationCategory,
} from '../../customer-notifications/dto/notification-query.dto';

export const DEVICE_PLATFORMS = ['ios', 'android'] as const;

/**
 * FCM registration tokens are ~150-200 characters of letters, digits and
 * `_ - : .` — APNs-backed ones include a colon. The bounds are generous; the
 * character class is what keeps a control character or whitespace out of a value
 * that is stored and later sent to Google.
 */
const TOKEN_RE = /^[A-Za-z0-9_:.-]+$/;

/** Body for `POST /devices`. */
export class RegisterDeviceDto {
  @ApiProperty({ description: 'The FCM registration token the app minted.' })
  @IsString()
  @Length(20, 4096)
  @Matches(TOKEN_RE, { message: 'token contains characters an FCM token cannot' })
  token!: string;

  @ApiProperty({ enum: DEVICE_PLATFORMS })
  @IsIn(DEVICE_PLATFORMS)
  platform!: (typeof DEVICE_PLATFORMS)[number];

  @ApiPropertyOptional({ description: 'App version, e.g. 1.0.0+3. Informational.' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  appVersion?: string;

  @ApiPropertyOptional({
    enum: NOTIFICATION_CATEGORIES,
    isArray: true,
    description:
      'Categories this device has opted out of. Honoured at send time: a muted category is never sent to this device.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(NOTIFICATION_CATEGORIES.length)
  @ArrayUnique()
  @IsIn(NOTIFICATION_CATEGORIES, { each: true })
  mutedCategories?: NotificationCategory[];
}

/**
 * Body for `POST /devices/deregister`.
 *
 * A POST with the token in the body rather than `DELETE /devices/:token`, so the
 * token never appears in a URL — request URLs are written to the access log, and
 * some proxies drop the body of a DELETE.
 */
export class DeregisterDeviceDto {
  @ApiProperty({ description: 'The FCM registration token to stop sending to.' })
  @IsString()
  @Length(20, 4096)
  @Matches(TOKEN_RE, { message: 'token contains characters an FCM token cannot' })
  token!: string;
}

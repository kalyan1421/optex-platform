import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { EYE_RECORD_STATUSES, type EyeRecordStatus } from './eye-record.dto';

/** Optional filters for `GET /admin/eye-records`. */
export class EyeRecordQueryDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Filter by customer.' })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ enum: EYE_RECORD_STATUSES, description: 'Filter by review status.' })
  @IsOptional()
  @IsIn(EYE_RECORD_STATUSES)
  status?: EyeRecordStatus;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { EYE_RECORD_STATUSES, type EyeRecordStatus } from './eye-record.dto';

/** Body for `PATCH /admin/eye-records/:id`. */
export class UpdateEyeRecordStatusDto {
  @ApiProperty({ enum: EYE_RECORD_STATUSES })
  @IsIn(EYE_RECORD_STATUSES)
  status!: EyeRecordStatus;
}

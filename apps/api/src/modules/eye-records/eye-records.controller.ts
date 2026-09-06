import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthUser } from '../../auth/auth-user';
import { CurrentUser } from '../../auth/decorators';
import { CreateEyeRecordDto } from './dto/create-eye-record.dto';
import { EyeRecordRow, EyeRecordsService } from './eye-records.service';

/**
 * Customer-facing eye-record endpoints. Mounted at `/api/eye-records` (global
 * `api` prefix applied in `main.ts`). All routes require a valid JWT (global
 * guard); every operation is scoped to the caller's own customer row.
 * HEALTH data — never exposes another customer's record.
 *
 * There is deliberately no update or delete route: a submitted clinical intake
 * is immutable from the storefront.
 */
@ApiTags('eye-records')
@ApiBearerAuth()
@Controller('eye-records')
export class EyeRecordsController {
  constructor(private readonly eyeRecords: EyeRecordsService) {}

  @Post()
  @ApiOperation({ summary: 'Submit an eye-care intake record' })
  @ApiCreatedResponse({ description: 'The created eye record' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateEyeRecordDto): Promise<EyeRecordRow> {
    return this.eyeRecords.create(user, dto);
  }

  @Get()
  @ApiOperation({ summary: "List the caller's own eye records" })
  @ApiOkResponse({ description: 'The caller’s eye records, newest first' })
  listMine(@CurrentUser() user: AuthUser): Promise<EyeRecordRow[]> {
    return this.eyeRecords.listMine(user);
  }
}

import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthUser } from '../../auth/auth-user';
import { CurrentUser } from '../../auth/decorators';
import { Throttle } from '@nestjs/throttler';
import { UploadPrescriptionDto } from './dto/upload-prescription.dto';
import {
  MAX_FILE_BYTES,
  PrescriptionRow,
  PrescriptionsService,
  UploadedFileLike,
} from './prescriptions.service';

/**
 * Customer-facing prescription endpoints. Mounted at `/api/prescriptions`
 * (global `api` prefix applied in `main.ts`). All routes require a valid JWT
 * (global guard); every operation is scoped to the caller's own customer row.
 * HEALTH data — never exposes another customer's prescription.
 */
/**
 * Uploads per minute per caller. A resolver rather than a constant so the value
 * is read per request — same idiom as `authRateLimit` in `auth.controller.ts`,
 * and what lets the e2e suite raise it.
 */
const uploadRateLimit = (): number => Number(process.env.UPLOAD_RATE_LIMIT ?? 20);

@ApiTags('prescriptions')
@ApiBearerAuth()
@Controller('prescriptions')
export class PrescriptionsController {
  constructor(private readonly prescriptions: PrescriptionsService) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload a prescription file (PDF/JPG/PNG, <=10MB)' })
  @ApiConsumes('multipart/form-data')
  @ApiCreatedResponse({ description: 'The created prescription row' })
  // Uploading is not a browsing action, so it does not belong in the global
  // 300/min browsing bucket — the same reasoning that gives payment initiation
  // its own ceiling. Overridable for the e2e suite, matching `authRateLimit`.
  @Throttle({ default: { ttl: 60_000, limit: uploadRateLimit } })
  //
  // `limits.fileSize` is the fix for the real exposure: multer's default is
  // Infinity and Nest buffers into memory, so the service's `file.size` check
  // only ran AFTER the entire body was in the heap. Measured before this: a
  // 300 MB POST was fully buffered, then rejected with 400. With a limit multer
  // aborts the stream at the ceiling instead. `files: 1` stops a caller
  // sending many parts to reach the same total.
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES, files: 1 } }))
  upload(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: UploadedFileLike,
    // Optional measurement fields submitted alongside the file.
    // (Validated by the global ValidationPipe against UploadPrescriptionDto.)
    @Body() body: UploadPrescriptionDto,
  ): Promise<PrescriptionRow> {
    return this.prescriptions.upload(user, file, body);
  }

  @Get()
  @ApiOperation({ summary: "List the caller's own prescriptions" })
  @ApiOkResponse({ description: 'The caller’s prescriptions, newest first' })
  listMine(@CurrentUser() user: AuthUser): Promise<PrescriptionRow[]> {
    return this.prescriptions.listMine(user);
  }

  @Get(':id/download')
  @ApiOperation({
    summary: 'Short-lived signed download URL for the caller’s own prescription',
  })
  @ApiOkResponse({ description: 'Signed URL valid for 60 seconds' })
  download(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<{ url: string; expiresIn: number }> {
    return this.prescriptions.downloadMine(user, id);
  }
}

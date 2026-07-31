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
import { UploadPrescriptionDto } from './dto/upload-prescription.dto';
import { PrescriptionRow, PrescriptionsService, UploadedFileLike } from './prescriptions.service';

/**
 * Customer-facing prescription endpoints. Mounted at `/api/prescriptions`
 * (global `api` prefix applied in `main.ts`). All routes require a valid JWT
 * (global guard); every operation is scoped to the caller's own customer row.
 * HEALTH data — never exposes another customer's prescription.
 */
@ApiTags('prescriptions')
@ApiBearerAuth()
@Controller('prescriptions')
export class PrescriptionsController {
  constructor(private readonly prescriptions: PrescriptionsService) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload a prescription file (PDF/JPG/PNG, <=10MB)' })
  @ApiConsumes('multipart/form-data')
  @ApiCreatedResponse({ description: 'The created prescription row' })
  @UseInterceptors(FileInterceptor('file'))
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

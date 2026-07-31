import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../auth/decorators';
import { ReviewsService } from './reviews.service';
import { UpdateReviewDto } from './dto/update-review.dto';
import { AdminReviewDto, REVIEW_STATUSES, ReviewDto, type ReviewStatus } from './dto/review.dto';

/**
 * Super-admin review moderation. Mounted at `/api/admin/reviews` (global prefix
 * applied in `main.ts`). Every route requires `role === 'super_admin'`,
 * enforced by the global `RolesGuard` via `@Roles`.
 */
@ApiTags('reviews')
@ApiBearerAuth()
@Roles('super_admin')
@Controller('admin/reviews')
export class AdminReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  @ApiOperation({ summary: 'List reviews (optionally filtered by status)' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: REVIEW_STATUSES,
    description: 'Filter by moderation status.',
  })
  @ApiOkResponse({ type: [AdminReviewDto], description: 'Matching reviews' })
  list(@Query('status') status?: ReviewStatus): Promise<AdminReviewDto[]> {
    // Ignore any out-of-enum value rather than 400 — treated as "no filter".
    const filter = REVIEW_STATUSES.includes(status as ReviewStatus) ? status : undefined;
    return this.reviews.listForAdmin(filter);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Moderate a review (approve / flag / set reply)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ReviewDto, description: 'The updated review' })
  moderate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReviewDto,
  ): Promise<ReviewDto> {
    return this.reviews.moderate(id, dto);
  }
}

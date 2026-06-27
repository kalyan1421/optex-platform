import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Length } from 'class-validator';
import { REVIEW_STATUSES, type ReviewStatus } from './review.dto';

/**
 * Body for `PATCH /admin/reviews/:id` — moderation.
 *
 * Used to approve / flag a review (`status`) and/or set an `admin_reply`.
 * `status` is constrained to the `review_status` enum
 * (`pending | approved | flagged`). Undefined fields are left untouched.
 */
export class UpdateReviewDto {
  @ApiPropertyOptional({
    description: 'New moderation status.',
    enum: REVIEW_STATUSES,
    example: 'approved',
  })
  @IsOptional()
  @IsIn(REVIEW_STATUSES)
  status?: ReviewStatus;

  @ApiPropertyOptional({
    description: 'Public admin reply attached to the review.',
    maxLength: 2000,
    example: 'Thanks for the feedback — glad you love the frames!',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  admin_reply?: string;
}

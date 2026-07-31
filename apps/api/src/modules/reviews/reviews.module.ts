import { Module } from '@nestjs/common';
import { ProductReviewsController } from './product-reviews.controller';
import { AdminReviewsController } from './admin-reviews.controller';
import { ReviewsService } from './reviews.service';

/**
 * REVIEWS module — product reviews + super-admin moderation.
 *
 * `SupabaseModule` is global, so `SupabaseService` is injectable here without
 * importing it. Wired into `AppModule` by the orchestrator.
 */
@Module({
  controllers: [ProductReviewsController, AdminReviewsController],
  providers: [ReviewsService],
})
export class ReviewsModule {}

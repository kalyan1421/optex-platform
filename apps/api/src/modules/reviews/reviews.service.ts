import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type { AuthUser } from '../../auth/auth-user';
import type { CreateReviewDto } from './dto/create-review.dto';
import type { UpdateReviewDto } from './dto/update-review.dto';
import {
  DEFAULT_REVIEW_STATUS,
  type ProductReviewsResponseDto,
  type ReviewDto,
  type ReviewStatus,
} from './dto/review.dto';

/** Columns selected from `product_reviews`. Mirrors the schema exactly. */
const REVIEW_COLUMNS =
  'id, product_id, customer_id, rating, body, status, admin_reply, created_at';

/** Postgres unique-violation code, raised on the duplicate-review constraint. */
const PG_UNIQUE_VIOLATION = '23505';

/**
 * REVIEWS domain logic.
 *
 * The service-role client bypasses RLS, so ownership is enforced here in code:
 * a customer review's `customer_id` references `customers.id`, which is resolved
 * from the caller's `auth_user_id` (the JWT `user.id`) before any write. The
 * public read path only ever returns `approved` reviews.
 */
@Injectable()
export class ReviewsService {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Lists approved reviews for a product plus an aggregate
   * `{ averageRating, count }`. Public — no auth, no pending/flagged rows.
   */
  async listApprovedForProduct(
    productId: string,
  ): Promise<ProductReviewsResponseDto> {
    const { data, error } = await this.supabase.client
      .from('product_reviews')
      .select(REVIEW_COLUMNS)
      .eq('product_id', productId)
      .eq('status', 'approved')
      .order('created_at', { ascending: false });

    if (error) {
      throw new InternalServerErrorException('Failed to load reviews');
    }

    const reviews = (data ?? []) as ReviewDto[];
    const count = reviews.length;
    const averageRating =
      count === 0
        ? null
        : Math.round(
            (reviews.reduce((sum, r) => sum + r.rating, 0) / count) * 10,
          ) / 10;

    return { reviews, aggregate: { averageRating, count } };
  }

  /**
   * Creates a review for `productId` authored by the caller. The review is
   * inserted with `status = 'pending'` (schema default) so it is held for
   * moderation. A customer may only review a given product once — a second
   * attempt raises `ConflictException`.
   *
   * NOTE: `dto.title` is intentionally dropped — there is no `title` column.
   */
  async createForProduct(
    user: AuthUser,
    productId: string,
    dto: CreateReviewDto,
  ): Promise<ReviewDto> {
    const customerId = await this.resolveCustomerId(user);

    // Defensive duplicate check (in addition to any DB constraint): one review
    // per customer per product.
    const { data: existing, error: existingError } = await this.supabase.client
      .from('product_reviews')
      .select('id')
      .eq('product_id', productId)
      .eq('customer_id', customerId)
      .maybeSingle<{ id: string }>();

    if (existingError) {
      throw new InternalServerErrorException('Failed to check existing review');
    }
    if (existing) {
      throw new ConflictException('You have already reviewed this product');
    }

    const { data, error } = await this.supabase.client
      .from('product_reviews')
      .insert({
        product_id: productId,
        customer_id: customerId,
        rating: dto.rating,
        body: dto.body ?? null,
        status: DEFAULT_REVIEW_STATUS,
      })
      .select(REVIEW_COLUMNS)
      .single<ReviewDto>();

    if (error) {
      // Race-safe fallback if a unique constraint exists on (product, customer).
      if (error.code === PG_UNIQUE_VIOLATION) {
        throw new ConflictException('You have already reviewed this product');
      }
      throw new InternalServerErrorException('Failed to create review');
    }
    if (!data) {
      throw new InternalServerErrorException('Failed to create review');
    }

    return data;
  }

  /**
   * Lists reviews for the admin panel, optionally filtered by moderation
   * `status`. Returns every status when no filter is supplied.
   */
  async listForAdmin(status?: ReviewStatus): Promise<ReviewDto[]> {
    let query = this.supabase.client
      .from('product_reviews')
      .select(REVIEW_COLUMNS)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      throw new InternalServerErrorException('Failed to load reviews');
    }

    return (data ?? []) as ReviewDto[];
  }

  /**
   * Moderates a review: approve / flag (via `status`) and/or set an
   * `admin_reply`. Only the fields present on the DTO are written. Throws
   * `ConflictException` if the review id does not exist.
   */
  async moderate(id: string, dto: UpdateReviewDto): Promise<ReviewDto> {
    const patch: { status?: ReviewStatus; admin_reply?: string | null } = {};
    if (dto.status !== undefined) patch.status = dto.status;
    if (dto.admin_reply !== undefined) {
      // Treat an empty reply as clearing the field.
      patch.admin_reply = dto.admin_reply === '' ? null : dto.admin_reply;
    }

    const { data, error } = await this.supabase.client
      .from('product_reviews')
      .update(patch)
      .eq('id', id)
      .select(REVIEW_COLUMNS)
      .maybeSingle<ReviewDto>();

    if (error) {
      throw new InternalServerErrorException('Failed to update review');
    }
    if (!data) {
      throw new ConflictException('Review not found');
    }

    return data;
  }

  /**
   * Resolves the caller's `customers.id` from their `auth_user_id` (the JWT
   * subject). Reviews reference `customers.id`, not the auth user directly, so
   * this hop is required before any write.
   */
  private async resolveCustomerId(user: AuthUser): Promise<string> {
    const { data, error } = await this.supabase.client
      .from('customers')
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle<{ id: string }>();

    if (error) {
      throw new InternalServerErrorException('Failed to resolve customer');
    }
    if (!data) {
      // The customers row is created by trigger on signup; if missing the
      // caller cannot own a review. Surface as conflict rather than 500.
      throw new ConflictException('Customer profile not found');
    }

    return data.id;
  }
}

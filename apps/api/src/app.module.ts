import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';

import { AuthModule } from './auth/auth.module';
import { RolesGuard } from './auth/roles.guard';
import { SupabaseAuthGuard } from './auth/supabase-auth.guard';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { CommonModule } from './common/common.module';
import { UserAwareThrottlerGuard } from './common/user-aware-throttler.guard';
import { validate } from './config/env';
import { HealthModule } from './health/health.module';
import { AccountModule } from './modules/account/account.module';
import { AddressesModule } from './modules/addresses/addresses.module';
import { AdminMetricsModule } from './modules/admin-metrics/admin-metrics.module';
import { AuthFlowModule } from './modules/auth/auth-flow.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { BranchesModule } from './modules/branches/branches.module';
import { CartModule } from './modules/cart/cart.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { CronModule } from './modules/cron/cron.module';
import { CustomersModule } from './modules/customers/customers.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { PrescriptionsModule } from './modules/prescriptions/prescriptions.module';
import { PromotionsModule } from './modules/promotions/promotions.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { WishlistModule } from './modules/wishlist/wishlist.module';
import { SupabaseModule } from './supabase/supabase.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        // Stable per-request id, reused from an inbound header if present.
        genReqId: (req: IncomingMessage) =>
          (req.headers['x-request-id'] as string | undefined) ?? randomUUID(),
        autoLogging: true,
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        // Pretty logs in dev; structured JSON in prod.
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : {
                target: 'pino-pretty',
                options: { singleLine: true, colorize: true },
              },
        redact: {
          paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
          remove: true,
        },
      },
    }),
    // Global rate limit, keyed per caller by `UserAwareThrottlerGuard` — bearer
    // token when signed in, real client IP otherwise (F-01).
    //
    // ONE global bucket, sized for a browsing storefront: a single page view
    // costs several calls, so the old 100/min throttled real users the moment
    // they clicked around.
    //
    // Deliberately not a second named bucket for auth. Every entry in this array
    // applies to every route — a `{ name: 'auth', limit: 10 }` entry here would
    // cap the WHOLE API at 10/min, which is exactly what it did on the first
    // attempt (the e2e suite went red with `x-ratelimit-limit-auth: 10` on
    // /api/cart). The credential endpoints instead OVERRIDE this bucket locally
    // with `@Throttle({ default: … })`, which is the mechanism that scopes to a
    // route.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 300 }]),
    ScheduleModule.forRoot(),
    SupabaseModule,
    AuthModule,
    CommonModule,
    HealthModule,
    // Phase 1A feature modules (Wave 1)
    AuthFlowModule,
    NotificationsModule,
    CatalogModule,
    AccountModule,
    PromotionsModule,
    BranchesModule,
    ReviewsModule,
    // Phase 1A feature modules (Wave 2)
    CartModule,
    AppointmentsModule,
    PrescriptionsModule,
    AdminMetricsModule,
    // Phase 1A feature modules (Wave 3)
    OrdersModule,
    PaymentsModule,
    CronModule,
    // Admin surfaces that replaced direct browser-to-Supabase access
    CustomersModule,
    InventoryModule,
    // Pending-features sprint plan (Sprint 2, Sprint 3)
    AddressesModule,
    WishlistModule,
  ],
  providers: [
    // Order matters: throttle -> authenticate -> authorize.
    { provide: APP_GUARD, useClass: UserAwareThrottlerGuard },
    { provide: APP_GUARD, useClass: SupabaseAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}

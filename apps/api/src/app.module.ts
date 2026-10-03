import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';

import { AuthModule } from './auth/auth.module';
import { PermissionsGuard } from './auth/permissions.guard';
import { SupabaseAuthGuard } from './auth/supabase-auth.guard';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { parseClientInfo } from './common/client-info';
import { CommonModule } from './common/common.module';
import { PostgresThrottlerStorage } from './common/postgres-throttler.storage';
import { UserAwareThrottlerGuard } from './common/user-aware-throttler.guard';
import { validate } from './config/env';
import { HealthModule } from './health/health.module';
import { AccountModule } from './modules/account/account.module';
import { AddressesModule } from './modules/addresses/addresses.module';
import { AdminMetricsModule } from './modules/admin-metrics/admin-metrics.module';
import { AuditLogModule } from './modules/audit-log/audit-log.module';
import { AuthFlowModule } from './modules/auth/auth-flow.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { BranchesModule } from './modules/branches/branches.module';
import { CartModule } from './modules/cart/cart.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { CronModule } from './modules/cron/cron.module';
import { CustomerNotificationsModule } from './modules/customer-notifications/customer-notifications.module';
import { CustomersModule } from './modules/customers/customers.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { EyeRecordsModule } from './modules/eye-records/eye-records.module';
import { PrescriptionsModule } from './modules/prescriptions/prescriptions.module';
import { PromotionsModule } from './modules/promotions/promotions.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { StaffModule } from './modules/staff/staff.module';
import { WishlistModule } from './modules/wishlist/wishlist.module';
import { SupabaseModule } from './supabase/supabase.module';
import { SupabaseService } from './supabase/supabase.service';

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
        // First-class `client` / `clientVersion` fields on every request line
        // (SPEC-11 §9), so "which app versions are in the wild" is a filter
        // rather than a hunt through raw headers. Sanitised: a header is a
        // caller-controlled string on its way into a log.
        customProps: (req: IncomingMessage) => {
          const { client, version } = parseClientInfo(req.headers);
          // Only what was sent: the storefront sends neither, and a `null` on
          // every one of its log lines would be noise.
          return { ...(client && { client }), ...(version && { clientVersion: version }) };
        },
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
    //
    // P-02: `storage` is a Postgres-backed provider rather than the default
    // in-memory one. The default keeps counters in a Map inside a single Node
    // process, so N replicas allowed N times every ceiling — measured in
    // production as 40 failed logins in a minute against a 10/min limit, with
    // one 429. `PostgresThrottlerStorage` puts the counters somewhere all
    // replicas can see. Swapping it for Redis later is a change to this one
    // line, exactly as `user-aware-throttler.guard.ts` predicted.
    ThrottlerModule.forRootAsync({
      imports: [SupabaseModule],
      inject: [SupabaseService],
      useFactory: (supabase: SupabaseService) => ({
        throttlers: [{ name: 'default', ttl: 60_000, limit: 300 }],
        storage: new PostgresThrottlerStorage(supabase),
      }),
    }),
    ScheduleModule.forRoot(),
    SupabaseModule,
    PermissionsModule,
    AuditLogModule,
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
    EyeRecordsModule,
    PrescriptionsModule,
    AdminMetricsModule,
    // Phase 1A feature modules (Wave 3)
    OrdersModule,
    PaymentsModule,
    CronModule,
    // Admin surfaces that replaced direct browser-to-Supabase access
    CustomersModule,
    InventoryModule,
    // CR-01 Phase 1B, R1 (RBAC)
    StaffModule,
    // Pending-features sprint plan (Sprint 2, Sprint 3)
    AddressesModule,
    WishlistModule,
    CustomerNotificationsModule,
  ],
  providers: [
    // Order matters: throttle -> authenticate -> authorize.
    { provide: APP_GUARD, useClass: UserAwareThrottlerGuard },
    { provide: APP_GUARD, useClass: SupabaseAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}

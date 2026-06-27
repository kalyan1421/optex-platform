import 'reflect-metadata';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Logger as PinoLogger } from 'nestjs-pino';

import { AppModule } from './app.module';

const DEFAULT_CORS_ORIGINS = ['http://localhost:3000', 'http://localhost:3001'];

function parseCorsOrigins(raw?: string): string[] {
  if (!raw) {
    return DEFAULT_CORS_ORIGINS;
  }
  const origins = raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  return origins.length > 0 ? origins : DEFAULT_CORS_ORIGINS;
}

async function bootstrap(): Promise<void> {
  // Payment webhooks (M-Pesa Daraja callback, Pesapal IPN) need the raw request
  // body available on `req.rawBody`. Note: neither Daraja STK callbacks nor
  // Pesapal IPN are cryptographically signed, so the real authenticity controls
  // are (a) provider IP allow-listing at the edge, (b) server-side status
  // re-query (Pesapal GetTransactionStatus / Daraja stkQuery), and (c) amount
  // verification before crediting an order — see PaymentsService. Raw body is
  // still captured here for verbatim audit logging and any future signed events.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });

  // Route Nest logs through pino.
  app.useLogger(app.get(PinoLogger));

  // Security headers.
  app.use(helmet());

  // CORS for the web storefront + admin panel.
  app.enableCors({
    origin: parseCorsOrigins(process.env.CORS_ORIGINS),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // All routes mounted under /api.
  app.setGlobalPrefix('api');

  // Validate + sanitize incoming DTOs.
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Graceful shutdown (closes DB/queue handles, flushes logs).
  app.enableShutdownHooks();

  // OpenAPI docs at /api/docs.
  const swaggerConfig = new DocumentBuilder()
    .setTitle('OPTEX API')
    .setDescription('Backend API for the OPTEX eyewear retail platform (Kenya)')
    .setVersion('0.1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'supabase',
    )
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 4000;
  await app.listen(port);

  const logger = app.get(PinoLogger);
  logger.log(`OPTEX API listening on http://localhost:${port}/api`);
  logger.log(`Swagger docs at http://localhost:${port}/api/docs`);
}

void bootstrap();

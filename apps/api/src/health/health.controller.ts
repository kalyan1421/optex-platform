import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../auth/decorators';

interface HealthResponse {
  status: 'ok';
  uptime: number;
  timestamp: string;
}

/**
 * Liveness probe. Public so load balancers / uptime checks can hit it without
 * a token. Mounted at `/api/health` (global prefix applied in `main.ts`).
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  // F-03 FIX: exempt from rate limiting. The probe used to draw from the same
  // bucket as customer traffic, so the failure mode inverted under load — at the
  // exact moment the quota saturated, the orchestrator's health check started
  // getting 429s and would restart containers that were working fine, shedding
  // capacity at peak. The webhook receivers already skip the throttler for the
  // same class of reason.
  @Public()
  @SkipThrottle()
  @Get()
  @ApiOperation({ summary: 'Liveness check' })
  @ApiOkResponse({
    description: 'Service is up',
    schema: {
      example: {
        status: 'ok',
        uptime: 12.34,
        timestamp: '2026-06-17T00:00:00.000Z',
      },
    },
  })
  check(): HealthResponse {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}

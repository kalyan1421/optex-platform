import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
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
  @Public()
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

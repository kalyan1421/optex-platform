import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthFlowService } from './auth-flow.service';

/**
 * Auth proxy module (`/api/auth`). Named AuthFlowModule to avoid clashing with
 * the guard-providing `AuthModule` in `src/auth`.
 */
@Module({
  controllers: [AuthController],
  providers: [AuthFlowService],
})
export class AuthFlowModule {}

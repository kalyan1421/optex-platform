import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

interface ErrorResponseBody {
  statusCode: number;
  code: string;
  error: string;
  message: string | string[];
  path: string;
  requestId?: string;
  timestamp: string;
}

/**
 * Catch-all exception filter producing a consistent JSON error envelope.
 *
 * - `HttpException`s are mapped to their status/message.
 * - Everything else becomes a 500 with a generic message (no stack leak).
 * - Stack traces are only logged, never returned; in production we also avoid
 *   echoing internal error details to the client.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { id?: string }>();

    const { statusCode, code, error, message } = this.resolveError(exception);

    const requestId =
      (request.id as string | undefined) ?? (request.headers['x-request-id'] as string | undefined);

    const body: ErrorResponseBody = {
      statusCode,
      code,
      error,
      message,
      path: request.url,
      requestId,
      timestamp: new Date().toISOString(),
    };

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} -> ${statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(`${request.method} ${request.url} -> ${statusCode} (${code})`);
    }

    response.status(statusCode).json(body);
  }

  private resolveError(exception: unknown): {
    statusCode: number;
    code: string;
    error: string;
    message: string | string[];
  } {
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const payload = exception.getResponse();

      let message: string | string[] = exception.message;
      let error = exception.name;

      if (typeof payload === 'object' && payload !== null) {
        const obj = payload as Record<string, unknown>;
        if (obj['message'] !== undefined) {
          message = obj['message'] as string | string[];
        }
        if (typeof obj['error'] === 'string') {
          error = obj['error'];
        }
      } else if (typeof payload === 'string') {
        message = payload;
      }

      return {
        statusCode,
        code: this.codeFromStatus(statusCode),
        error,
        message,
      };
    }

    // Unknown / unexpected error -> 500. NEVER echo the raw error message to the
    // client (it can leak DB errors, file paths, and Supabase internals — a
    // recon aid). The full stack is logged server-side in `catch()`; correlate
    // via the `requestId` returned in the envelope.
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_SERVER_ERROR',
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
    };
  }

  private codeFromStatus(status: number): string {
    const key = Object.keys(HttpStatus).find(
      (k) => (HttpStatus as Record<string, unknown>)[k] === status,
    );
    return key ?? `HTTP_${status}`;
  }
}

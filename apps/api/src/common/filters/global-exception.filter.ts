import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiErrorCode } from '@ac/types';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Logger } from 'nestjs-pino';
import { ZodError } from 'zod';

/**
 * Global exception filter — coerces every thrown error into the canonical
 * `ApiError` envelope so clients always get a predictable shape.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    const { statusCode, code, message, details } = this.normalize(exception);
    const requestId = (request.id as string | undefined) ?? 'unknown';

    if (statusCode >= 500) {
      this.logger.error(
        { err: exception, requestId, path: request.url, statusCode },
        `Unhandled error: ${message}`,
      );
    } else {
      this.logger.warn(
        { requestId, path: request.url, statusCode, code },
        `Handled error: ${message}`,
      );
    }

    void response.status(statusCode).send({
      success: false,
      error: { code, message, statusCode, details },
      requestId,
    });
  }

  private normalize(exception: unknown): {
    statusCode: number;
    code: ApiErrorCode | string;
    message: string;
    details?: unknown;
  } {
    if (exception instanceof ZodError) {
      return {
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        code: ApiErrorCode.VALIDATION_ERROR,
        message: 'Validation failed',
        details: exception.flatten(),
      };
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const resp = exception.getResponse();
      const message =
        typeof resp === 'string'
          ? resp
          : (resp as { message?: string | string[] }).message
            ? Array.isArray((resp as { message: string[] }).message)
              ? (resp as { message: string[] }).message.join(', ')
              : ((resp as { message: string }).message as string)
            : exception.message;
      const customCode =
        typeof resp === 'object' && resp !== null && 'code' in resp
          ? String((resp as { code: string }).code)
          : undefined;
      return {
        statusCode: status,
        code: customCode ?? this.codeFromStatus(status),
        message,
        details: typeof resp === 'object' ? resp : undefined,
      };
    }
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ApiErrorCode.INTERNAL,
      message: 'Internal server error',
    };
  }

  private codeFromStatus(status: number): ApiErrorCode {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ApiErrorCode.BAD_REQUEST;
      case HttpStatus.UNAUTHORIZED:
        return ApiErrorCode.UNAUTHORIZED;
      case HttpStatus.FORBIDDEN:
        return ApiErrorCode.FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return ApiErrorCode.NOT_FOUND;
      case HttpStatus.CONFLICT:
        return ApiErrorCode.CONFLICT;
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return ApiErrorCode.VALIDATION_ERROR;
      case HttpStatus.TOO_MANY_REQUESTS:
        return ApiErrorCode.RATE_LIMITED;
      case HttpStatus.SERVICE_UNAVAILABLE:
        return ApiErrorCode.SERVICE_UNAVAILABLE;
      case HttpStatus.GATEWAY_TIMEOUT:
        return ApiErrorCode.GATEWAY_TIMEOUT;
      default:
        return status >= 500 ? ApiErrorCode.INTERNAL : ApiErrorCode.BAD_REQUEST;
    }
  }
}

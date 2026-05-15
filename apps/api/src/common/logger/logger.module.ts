import { Global, Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';

/**
 * Pino structured logger with request id correlation and dev-time pretty
 * printing. In production we emit JSON for ingestion by Loki/Datadog/etc.
 */
@Global()
@Module({
  imports: [
    PinoLoggerModule.forRoot({
      pinoHttp: {
        level: process.env['LOG_LEVEL'] ?? 'info',
        autoLogging: { ignore: (req) => req.url === '/api/v1/health' },
        genReqId: (req) => {
          const existing = req.headers['x-request-id'];
          return typeof existing === 'string' && existing.length > 0 ? existing : randomUUID();
        },
        customProps: (req) => ({
          requestId: req.id,
        }),
        serializers: {
          req(req: { id: unknown; method: unknown; url: unknown; headers: Record<string, unknown> }) {
            return {
              id: req.id,
              method: req.method,
              url: req.url,
              userAgent: req.headers['user-agent'],
            };
          },
          res(res: { statusCode: unknown }) {
            return { statusCode: res.statusCode };
          },
        },
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            '*.password',
            '*.passwordHash',
            '*.refreshToken',
            '*.accessToken',
          ],
          censor: '[REDACTED]',
        },
        transport:
          process.env['NODE_ENV'] === 'production'
            ? undefined
            : {
                target: 'pino-pretty',
                options: { colorize: true, singleLine: false, translateTime: 'SYS:HH:MM:ss.l' },
              },
      },
    }),
  ],
})
export class LoggerModule {}

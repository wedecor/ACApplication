import 'reflect-metadata';

import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compress from '@fastify/compress';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { parseTrustProxy } from './common/http/trust-proxy';
import { RedisIoAdapter } from './common/redis/redis-io.adapter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { installBigIntJson } from './common/serialization/bigint-json';

installBigIntJson();

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    // 6 MiB body limit: CSV imports (data-io) accept up to 5 MB of text.
    new FastifyAdapter({ trustProxy: parseTrustProxy(process.env['TRUST_PROXY']), logger: false, bodyLimit: 6 * 1024 * 1024 }),
    { bufferLogs: true, rawBody: true },
  );

  // Pino-based structured logger.
  app.useLogger(app.get(Logger));

  // Websocket broadcasts reach sockets on every instance via Redis.
  app.useWebSocketAdapter(new RedisIoAdapter(app));

  // Security headers + CORS.
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(compress);
  await app.register(cors, {
    origin: (origin, cb) => {
      // CORS_EXTRA_ORIGINS: comma-separated, e.g. Expo web previews on http://localhost:8081.
      const extra = (process.env['CORS_EXTRA_ORIGINS'] ?? '').split(',').map((o) => o.trim());
      const allow = [process.env['WEB_URL'], process.env['ADMIN_URL'], ...extra].filter(Boolean) as string[];
      if (!origin || allow.includes(origin)) cb(null, true);
      else cb(new Error(`Origin ${origin} not allowed`), false);
    },
    credentials: true,
  });

  // API versioning — /v1/...
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // Global pipes / filters / interceptors.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter(app.get(Logger)));
  app.useGlobalInterceptors(new ResponseInterceptor());

  // Swagger / OpenAPI.
  if (process.env['NODE_ENV'] !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('AC Platform API')
      .setDescription('Service Operations Platform')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const doc = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, doc, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  // Graceful shutdown hooks (closes Prisma, Redis, etc).
  app.enableShutdownHooks();

  const port = Number(process.env['PORT'] ?? 4000);
  await app.listen(port, '0.0.0.0');
  app.get(Logger).log(`API listening on http://localhost:${port}`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal bootstrap error:', err);
  process.exit(1);
});

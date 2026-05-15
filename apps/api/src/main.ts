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
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: true, logger: false }),
    { bufferLogs: true, rawBody: true },
  );

  // Pino-based structured logger.
  app.useLogger(app.get(Logger));

  // Security headers + CORS.
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(compress);
  await app.register(cors, {
    origin: (origin, cb) => {
      const allow = [process.env['WEB_URL'], process.env['ADMIN_URL']].filter(Boolean) as string[];
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

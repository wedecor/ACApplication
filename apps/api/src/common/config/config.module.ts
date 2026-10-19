import { type LoadedServerEnv,loadServerEnv } from '@ac/config';
import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

export const APP_CONFIG = Symbol('APP_CONFIG');

/**
 * Wraps `@nestjs/config` with the Zod-validated env loader from `@ac/config`.
 * Throws at boot if any required variable is missing/invalid.
 */
@Global()
@Module({
  imports: [NestConfigModule.forRoot({ ignoreEnvFile: false, isGlobal: true })],
  providers: [
    {
      provide: APP_CONFIG,
      useFactory: (): LoadedServerEnv => loadServerEnv(process.env),
    },
  ],
  exports: [APP_CONFIG],
})
export class ConfigModule {}

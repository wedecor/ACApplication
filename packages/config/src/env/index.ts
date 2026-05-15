import { z, ZodError } from 'zod';

import { clientEnvSchema, serverEnvSchema } from './schema';

export * from './schema';

interface LoadOptions {
  emptyStringAsUndefined?: boolean;
  skipValidation?: boolean;
}

function normaliseSource(
  source: Record<string, string | undefined>,
  emptyStringAsUndefined: boolean,
): Record<string, string | undefined> {
  if (!emptyStringAsUndefined) return source;
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(source)) {
    out[key] = value === '' ? undefined : value;
  }
  return out;
}

function reportError(label: string, error: ZodError): never {
  console.error(`Invalid ${label} environment variables:`);
  console.error(JSON.stringify(error.flatten().fieldErrors, null, 2));
  throw new Error(`Invalid ${label} environment variables`);
}

/**
 * Parses & validates the *server* environment. Throws at boot time if any
 * required var is missing or malformed. Always call this exactly once at
 * application startup (e.g. inside `ConfigModule.forRoot`).
 */
export function loadServerEnv(
  source: NodeJS.ProcessEnv = process.env,
  options: LoadOptions = {},
) {
  const { emptyStringAsUndefined = true, skipValidation = source['SKIP_ENV_VALIDATION'] === 'true' } =
    options;
  const normalised = normaliseSource(source, emptyStringAsUndefined);
  if (skipValidation) {
    return normalised as unknown as z.infer<typeof serverEnvSchema>;
  }
  const result = serverEnvSchema.safeParse(normalised);
  if (!result.success) {
    reportError('server', result.error);
  }
  return result.data;
}

/**
 * Parses & validates the public client env. Use this in Next.js apps via
 * a thin wrapper that supplies the explicit `runtimeEnv` allow-list.
 */
export function loadClientEnv(
  runtimeEnv: Record<string, string | undefined>,
  options: LoadOptions = {},
) {
  const { emptyStringAsUndefined = true, skipValidation = false } = options;
  const normalised = normaliseSource(runtimeEnv, emptyStringAsUndefined);
  if (skipValidation) {
    return normalised as unknown as z.infer<typeof clientEnvSchema>;
  }
  const result = clientEnvSchema.safeParse(normalised);
  if (!result.success) {
    reportError('client', result.error);
  }
  return result.data;
}

export type LoadedServerEnv = ReturnType<typeof loadServerEnv>;
export type LoadedClientEnv = ReturnType<typeof loadClientEnv>;

/** Merge extra fields validated after the base server schema. */
export function extendServerEnv<T extends z.ZodRawShape>(extension: T) {
  return serverEnvSchema.and(z.object(extension));
}

import Constants from 'expo-constants';

/**
 * Runtime configuration. Pulled from `app.json -> expo.extra` so the same
 * binary can be promoted across environments by toggling a single config
 * file (or EAS profile) without rebuilding the bundle.
 */
export interface AppConfig {
  apiUrl: string;
  wsUrl: string;
  whatsappNumber: string;
  supportPhone: string;
  supportEmail: string;
}

function readExtra(): Record<string, unknown> {
  const extra = (Constants?.expoConfig?.extra ?? {}) as Record<string, unknown>;
  return extra;
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

export const config: AppConfig = (() => {
  const extra = readExtra();
  return {
    apiUrl: stringOr(extra.apiUrl, 'http://localhost:3000'),
    wsUrl: stringOr(extra.wsUrl, 'http://localhost:3000'),
    whatsappNumber: stringOr(extra.whatsappNumber, '+919999999999'),
    supportPhone: stringOr(extra.supportPhone, '+919999999999'),
    supportEmail: stringOr(extra.supportEmail, 'care@acplatform.in'),
  };
})();

/** API base used by both REST and websocket clients. */
export const apiBase = (path: string): string => {
  const base = config.apiUrl.replace(/\/$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}${suffix}`;
};

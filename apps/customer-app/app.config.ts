import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Extends app.json so local builds can target a dev API without editing it:
 * EXPO_PUBLIC_API_URL / EXPO_PUBLIC_WS_URL override `extra.apiUrl` / `extra.wsUrl`.
 */
export default ({ config }: ConfigContext): ExpoConfig =>
  ({
    ...config,
    extra: {
      ...config.extra,
      apiUrl: process.env.EXPO_PUBLIC_API_URL ?? config.extra?.apiUrl,
      wsUrl: process.env.EXPO_PUBLIC_WS_URL ?? config.extra?.wsUrl,
    },
  }) as ExpoConfig;

/** Circuit breaker state persisted in Redis by the API layer. */
export type CircuitState = 'closed' | 'open' | 'half_open';

export interface CircuitSnapshot {
  state: CircuitState;
  failures: number;
  openedAt: string | null;
  halfOpenAt: string | null;
  lastFailureAt: string | null;
  lastSuccessAt: string | null;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  openDurationMs: number;
  halfOpenProbeSuccesses: number;
}

export const DEFAULT_CIRCUIT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  openDurationMs: 60_000,
  halfOpenProbeSuccesses: 2,
};

export function circuitKey(channel: string, provider: string): string {
  return `notif:circuit:${channel}:${provider}`;
}

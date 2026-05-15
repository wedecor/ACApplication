import { Inject, Injectable } from '@nestjs/common';
import type { LoadedServerEnv } from '@ac/config';
import {
  circuitKey,
  DEFAULT_CIRCUIT_CONFIG,
  type CircuitSnapshot,
  type CircuitState,
} from '@ac/notifications';
import { NotificationChannel } from '@ac/types';

import { APP_CONFIG } from '../../common/config/config.module';
import { RedisService } from '../../common/redis/redis.service';

@Injectable()
export class ProviderHealthService {
  private readonly config = DEFAULT_CIRCUIT_CONFIG;

  constructor(
    private readonly redis: RedisService,
    @Inject(APP_CONFIG) env: LoadedServerEnv,
  ) {
    this.config = {
      failureThreshold: env.NOTIFICATION_CIRCUIT_FAILURE_THRESHOLD,
      openDurationMs: env.NOTIFICATION_CIRCUIT_OPEN_MS,
      halfOpenProbeSuccesses: 2,
    };
  }

  async isAvailable(channel: NotificationChannel, provider: string): Promise<boolean> {
    const snap = await this.getSnapshot(channel, provider);
    if (snap.state === 'closed') return true;
    if (snap.state === 'half_open') return true;
    if (snap.state === 'open' && snap.openedAt) {
      const elapsed = Date.now() - new Date(snap.openedAt).getTime();
      if (elapsed >= this.config.openDurationMs) {
        await this.setState(channel, provider, 'half_open');
        return true;
      }
      return false;
    }
    return false;
  }

  async recordSuccess(channel: NotificationChannel, provider: string): Promise<void> {
    const key = circuitKey(channel, provider);
    const snap = await this.getSnapshot(channel, provider);
    if (snap.state === 'half_open') {
      const successes = (snap as CircuitSnapshot & { halfOpenSuccesses?: number })
        .halfOpenSuccesses ?? 0;
      if (successes + 1 >= this.config.halfOpenProbeSuccesses) {
        await this.redis.default.set(
          key,
          JSON.stringify({
            state: 'closed',
            failures: 0,
            openedAt: null,
            halfOpenAt: null,
            lastFailureAt: snap.lastFailureAt,
            lastSuccessAt: new Date().toISOString(),
          } satisfies CircuitSnapshot),
        );
        return;
      }
      await this.redis.default.set(
        key,
        JSON.stringify({
          ...snap,
          halfOpenSuccesses: successes + 1,
          lastSuccessAt: new Date().toISOString(),
        }),
      );
      return;
    }
    await this.redis.default.set(
      key,
      JSON.stringify({
        state: 'closed',
        failures: 0,
        openedAt: null,
        halfOpenAt: null,
        lastFailureAt: snap.lastFailureAt,
        lastSuccessAt: new Date().toISOString(),
      } satisfies CircuitSnapshot),
    );
  }

  async recordFailure(channel: NotificationChannel, provider: string): Promise<void> {
    const key = circuitKey(channel, provider);
    const snap = await this.getSnapshot(channel, provider);
    const failures = snap.failures + 1;
    const now = new Date().toISOString();
    if (failures >= this.config.failureThreshold) {
      await this.redis.default.set(
        key,
        JSON.stringify({
          state: 'open',
          failures,
          openedAt: now,
          halfOpenAt: null,
          lastFailureAt: now,
          lastSuccessAt: snap.lastSuccessAt,
        } satisfies CircuitSnapshot),
        'EX',
        Math.ceil(this.config.openDurationMs / 1000) * 2,
      );
      return;
    }
    await this.redis.default.set(
      key,
      JSON.stringify({
        ...snap,
        failures,
        lastFailureAt: now,
      } satisfies CircuitSnapshot),
    );
  }

  async listProviderHealth(): Promise<
    Array<{ channel: NotificationChannel; provider: string; snapshot: CircuitSnapshot }>
  > {
    const keys = await this.redis.default.keys('notif:circuit:*');
    const out: Array<{
      channel: NotificationChannel;
      provider: string;
      snapshot: CircuitSnapshot;
    }> = [];
    for (const key of keys) {
      const parts = key.split(':');
      const channel = parts[2] as NotificationChannel;
      const provider = parts.slice(3).join(':');
      out.push({ channel, provider, snapshot: await this.getSnapshot(channel, provider) });
    }
    return out;
  }

  private async getSnapshot(
    channel: NotificationChannel,
    provider: string,
  ): Promise<CircuitSnapshot> {
    const raw = await this.redis.default.get(circuitKey(channel, provider));
    if (!raw) {
      return {
        state: 'closed',
        failures: 0,
        openedAt: null,
        halfOpenAt: null,
        lastFailureAt: null,
        lastSuccessAt: null,
      };
    }
    return JSON.parse(raw) as CircuitSnapshot;
  }

  private async setState(
    channel: NotificationChannel,
    provider: string,
    state: CircuitState,
  ): Promise<void> {
    const snap = await this.getSnapshot(channel, provider);
    await this.redis.default.set(
      circuitKey(channel, provider),
      JSON.stringify({
        ...snap,
        state,
        halfOpenAt: state === 'half_open' ? new Date().toISOString() : snap.halfOpenAt,
      }),
    );
  }
}

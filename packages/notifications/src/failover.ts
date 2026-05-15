import type { NotificationChannel } from '@ac/types';

import type {
  NotificationMessage,
  NotificationRecipient,
  NotificationTransport,
  SendResult,
} from './index';

export interface NamedProvider {
  name: string;
  transport: NotificationTransport;
  priority: number;
}

export interface FailoverSendContext {
  channel: NotificationChannel;
  recipient: NotificationRecipient;
  message: NotificationMessage;
  /** Skip providers with an open circuit. */
  isProviderAvailable: (provider: string) => Promise<boolean>;
  onProviderSuccess: (provider: string, latencyMs: number) => Promise<void>;
  onProviderFailure: (provider: string, error: string, latencyMs: number) => Promise<void>;
}

/**
 * Attempts providers in priority order until one succeeds or all fail.
 */
export async function sendWithFailover(
  providers: NamedProvider[],
  ctx: FailoverSendContext,
): Promise<SendResult & { provider?: string }> {
  const ordered = [...providers].sort((a, b) => a.priority - b.priority);
  const errors: string[] = [];

  for (const { name, transport } of ordered) {
    const available = await ctx.isProviderAvailable(name);
    if (!available) {
      errors.push(`${name}: circuit open`);
      continue;
    }

    const started = Date.now();
    try {
      const result = await transport.send(ctx.recipient, ctx.message);
      const latencyMs = Date.now() - started;
      if (result.status === 'sent') {
        await ctx.onProviderSuccess(name, latencyMs);
        return { ...result, provider: name };
      }
      const err = result.error ?? 'Provider returned failed';
      await ctx.onProviderFailure(name, err, latencyMs);
      errors.push(`${name}: ${err}`);
    } catch (err) {
      const latencyMs = Date.now() - started;
      const msg = err instanceof Error ? err.message : 'Unknown error';
      await ctx.onProviderFailure(name, msg, latencyMs);
      errors.push(`${name}: ${msg}`);
    }
  }

  return {
    channel: ctx.channel,
    status: 'failed',
    error: errors.join(' | ') || 'No providers available',
  };
}

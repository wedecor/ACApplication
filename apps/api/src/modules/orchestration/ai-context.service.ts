import type { AnyDomainEvent } from '@ac/types';
import { Injectable } from '@nestjs/common';

export interface AiDecisionResult {
  nextStepKey?: string;
  confidence?: number;
  rationale?: string;
}

/**
 * Pluggable AI decision layer. Returns deterministic defaults until an
 * external model is wired via AI_DECISION_ENGINE_URL.
 */
@Injectable()
export class AiContextService {
  buildSnapshot(envelope: AnyDomainEvent): Promise<Record<string, unknown>> {
    return Promise.resolve({
      event: envelope.name,
      payload: envelope.payload,
      capturedAt: new Date().toISOString(),
      version: 1,
    });
  }

  // eslint-disable-next-line @typescript-eslint/require-await -- placeholder for a model call; keeps the async contract
  async decide(
    hook: string,
    context: Record<string, unknown>,
    snapshot: unknown,
  ): Promise<AiDecisionResult> {
    void snapshot;
    if (hook === 'dispatch_priority') {
      const booking = context.booking as Record<string, unknown> | undefined;
      const minutes = Number(booking?.ageMinutes ?? 0);
      return {
        nextStepKey: minutes > 30 ? 'escalate_dispatch' : 'notify_customer',
        confidence: 0.7,
        rationale: 'Heuristic dispatch priority',
      };
    }
    return { nextStepKey: undefined, confidence: 1, rationale: 'Default path' };
  }
}

import { Injectable } from '@nestjs/common';

import type { ConversationChannel, TicketPriority } from '@ac/types';

/**
 * AI extension points. The methods here are deliberately thin shims — they
 * exist so the rest of the platform can call them without depending on a
 * specific provider (OpenAI, Anthropic, Azure, etc). Each method returns
 * `null` today; once a provider is wired in, this file is the only place
 * to change.
 *
 * Use:
 *   - `categorise()` from `TicketsService.create` to fill `category` /
 *     `subcategory` on inbound emails / web-chat messages where the user
 *     didn't pick one.
 *   - `analyseSentiment()` from `ConversationsService.ingestInbound` to
 *     bump priority when the customer is upset.
 *   - `suggestReply()` from the agent UI to render a "smart reply" button.
 *   - `summariseConversation()` from `TicketsService.merge` so the merged
 *     ticket carries the right summary in the activity log.
 */
@Injectable()
export class SupportAiHooksService {
  async categorise(args: {
    subject: string;
    body: string;
    knownCategories: string[];
  }): Promise<{ category: string | null; confidence: number } | null> {
    void args;
    return null;
  }

  async analyseSentiment(args: {
    body: string;
    channel: ConversationChannel;
  }): Promise<{ sentiment: 'positive' | 'neutral' | 'negative'; score: number; suggestedPriority?: TicketPriority } | null> {
    void args;
    return null;
  }

  async suggestReply(args: {
    ticketId: string;
    last5Messages: string[];
    channel: ConversationChannel;
    cannedResponses: Array<{ code: string; title: string; body: string }>;
  }): Promise<{ suggestions: Array<{ body: string; source: 'ai' | 'canned'; cannedCode?: string }> } | null> {
    void args;
    return null;
  }

  async summariseConversation(args: {
    ticketId: string;
    messages: Array<{ authorKind: string; body: string }>;
  }): Promise<{ summary: string } | null> {
    void args;
    return null;
  }
}

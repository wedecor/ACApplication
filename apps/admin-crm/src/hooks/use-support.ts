'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  callsApi,
  cannedApi,
  conversationsApi,
  kbApi,
  slaApi,
  supportAnalyticsApi,
  ticketsApi,
  type CallSummary,
  type ConversationChannel,
  type ConversationMessage,
  type ConversationSummary,
  type ConversationStatus,
  type ListCallsParams,
  type ListConversationsParams,
  type ListTicketsParams,
  type MessageDirection,
  type TicketActivity,
  type TicketMessage,
  type TicketPriority,
  type TicketStatus,
  type TicketSummary,
  type CustomerContext,
} from '@/lib/api/support';
import { queryKeys } from '@/lib/api/query-keys';

// ----------------------------------------------------------- tickets

export function useTickets(params: ListTicketsParams) {
  return useQuery({
    queryKey: queryKeys.support.tickets.list(params as Record<string, unknown>),
    queryFn: () => ticketsApi.list(params),
    placeholderData: (prev) => prev,
  });
}

export function useTicket(id: string | undefined) {
  return useQuery({
    queryKey: id ? queryKeys.support.tickets.detail(id) : ['support', 'tickets', 'noop'],
    queryFn: () => ticketsApi.detail(id as string) as Promise<TicketSummary>,
    enabled: !!id,
  });
}

export function useTicketActivities(id: string | undefined) {
  return useQuery({
    queryKey: id ? queryKeys.support.tickets.activities(id) : ['support', 'tickets', 'noop-act'],
    queryFn: () => ticketsApi.activities(id as string) as Promise<TicketActivity[]>,
    enabled: !!id,
  });
}

export function useTicketMessages(id: string | undefined) {
  return useQuery({
    queryKey: id ? queryKeys.support.tickets.messages(id) : ['support', 'tickets', 'noop-msg'],
    queryFn: () => ticketsApi.messages(id as string) as Promise<TicketMessage[]>,
    enabled: !!id,
  });
}

export function useTicketCustomerContext(id: string | undefined) {
  return useQuery({
    queryKey: id
      ? queryKeys.support.tickets.customerContext(id)
      : ['support', 'tickets', 'noop-ctx'],
    queryFn: () =>
      ticketsApi.customerContext(id as string) as Promise<CustomerContext>,
    enabled: !!id,
  });
}

export function useTicketActions(id: string | undefined) {
  const qc = useQueryClient();
  const invalidate = async () => {
    if (!id) return;
    await Promise.all([
      qc.invalidateQueries({ queryKey: queryKeys.support.tickets.detail(id) }),
      qc.invalidateQueries({ queryKey: queryKeys.support.tickets.activities(id) }),
      qc.invalidateQueries({ queryKey: queryKeys.support.tickets.messages(id) }),
      qc.invalidateQueries({ queryKey: queryKeys.support.tickets.all }),
    ]);
  };
  return {
    create: useMutation({
      mutationFn: ticketsApi.create,
      onSuccess: async () => {
        await qc.invalidateQueries({ queryKey: queryKeys.support.tickets.all });
      },
    }),
    update: useMutation({
      mutationFn: (body: Parameters<typeof ticketsApi.update>[1]) =>
        ticketsApi.update(id as string, body),
      onSuccess: invalidate,
    }),
    assign: useMutation({
      mutationFn: (body: { assignedAgentId: string; team?: string }) =>
        ticketsApi.assign(id as string, body),
      onSuccess: invalidate,
    }),
    escalate: useMutation({
      mutationFn: (body: { level?: number; reason?: string; assignToUserId?: string }) =>
        ticketsApi.escalate(id as string, body),
      onSuccess: invalidate,
    }),
    changeStatus: useMutation({
      mutationFn: (body: { status: TicketStatus; reason?: string }) =>
        ticketsApi.changeStatus(id as string, body),
      onSuccess: invalidate,
    }),
    resolve: useMutation({
      mutationFn: (reason?: string) => ticketsApi.resolve(id as string, reason),
      onSuccess: invalidate,
    }),
    close: useMutation({
      mutationFn: (reason?: string) => ticketsApi.close(id as string, reason),
      onSuccess: invalidate,
    }),
    reopen: useMutation({
      mutationFn: (reason?: string) => ticketsApi.reopen(id as string, reason),
      onSuccess: invalidate,
    }),
    addNote: useMutation({
      mutationFn: (body: { body: string; isInternal?: boolean }) =>
        ticketsApi.note(id as string, body),
      onSuccess: invalidate,
    }),
    reply: useMutation({
      mutationFn: (body: {
        body: string;
        channel: ConversationChannel;
        conversationId?: string;
        templateName?: string;
      }) => ticketsApi.reply(id as string, body),
      onSuccess: invalidate,
    }),
    merge: useMutation({
      mutationFn: (body: { targetTicketId: string }) =>
        ticketsApi.merge(id as string, body),
      onSuccess: invalidate,
    }),
    csat: useMutation({
      mutationFn: (body: { rating: number; comment?: string }) =>
        ticketsApi.csat(id as string, body),
      onSuccess: invalidate,
    }),
  };
}

// ------------------------------------------------------- conversations

export function useConversations(params: ListConversationsParams) {
  return useQuery({
    queryKey: queryKeys.support.inbox.conversations(params as Record<string, unknown>),
    queryFn: () => conversationsApi.list(params),
    placeholderData: (prev) => prev,
  });
}

export function useConversation(id: string | undefined) {
  return useQuery({
    queryKey: id ? queryKeys.support.inbox.detail(id) : ['support', 'inbox', 'noop'],
    queryFn: () => conversationsApi.detail(id as string) as Promise<ConversationSummary>,
    enabled: !!id,
  });
}

export function useConversationMessages(
  id: string | undefined,
  params: { limit?: number; cursor?: string; direction?: MessageDirection } = {},
) {
  return useQuery({
    queryKey: id
      ? queryKeys.support.inbox.messages(id, params as Record<string, unknown>)
      : ['support', 'inbox', 'noop-msg'],
    queryFn: () =>
      conversationsApi.messages(id as string, params) as Promise<{
        items: ConversationMessage[];
        nextCursor: string | null;
      }>,
    enabled: !!id,
  });
}

export function useConversationActions(id: string | undefined) {
  const qc = useQueryClient();
  const invalidate = async () => {
    if (!id) return;
    await Promise.all([
      qc.invalidateQueries({ queryKey: queryKeys.support.inbox.detail(id) }),
      qc.invalidateQueries({ queryKey: queryKeys.support.inbox.conversations({}) }),
      qc.invalidateQueries({ queryKey: ['support', 'inbox', 'conversations', id, 'messages'] }),
    ]);
  };
  return {
    assign: useMutation({
      mutationFn: (body: { assignedAgentId: string }) =>
        conversationsApi.assign(id as string, body),
      onSuccess: invalidate,
    }),
    send: useMutation({
      mutationFn: (body: { body: string; channel: ConversationChannel; templateName?: string }) =>
        conversationsApi.send(id as string, body),
      onSuccess: invalidate,
    }),
    read: useMutation({
      mutationFn: (body: { lastMessageId?: string } = {}) =>
        conversationsApi.read(id as string, body),
      onSuccess: invalidate,
    }),
    close: useMutation({
      mutationFn: () => conversationsApi.close(id as string),
      onSuccess: invalidate,
    }),
  };
}

// ------------------------------------------------------------- calls

export function useCalls(params: ListCallsParams) {
  return useQuery({
    queryKey: queryKeys.support.calls.list(params as Record<string, unknown>),
    queryFn: () => callsApi.list(params),
    placeholderData: (prev) => prev,
  });
}

export function useMissedCallQueue() {
  return useQuery({
    queryKey: queryKeys.support.calls.missed,
    queryFn: () => callsApi.missedQueue() as Promise<CallSummary[]>,
  });
}

export function useCallActions() {
  const qc = useQueryClient();
  return {
    clickToCall: useMutation({
      mutationFn: callsApi.clickToCall,
      onSuccess: async () => {
        await qc.invalidateQueries({ queryKey: ['support', 'calls'] });
      },
    }),
    setDisposition: useMutation({
      mutationFn: ({ id, body }: { id: string; body: Parameters<typeof callsApi.setDisposition>[1] }) =>
        callsApi.setDisposition(id, body),
      onSuccess: async () => {
        await qc.invalidateQueries({ queryKey: ['support', 'calls'] });
      },
    }),
  };
}

// --------------------------------------------------------- knowledge base

export function useKbCategories() {
  return useQuery({
    queryKey: queryKeys.support.kb.categories,
    queryFn: kbApi.categories,
  });
}

export function useKbArticles(params: Parameters<typeof kbApi.articles>[0]) {
  return useQuery({
    queryKey: queryKeys.support.kb.articles(params as Record<string, unknown>),
    queryFn: () => kbApi.articles(params),
    placeholderData: (prev) => prev,
  });
}

export function useKbArticle(id: string | undefined) {
  return useQuery({
    queryKey: id ? queryKeys.support.kb.article(id) : ['support', 'kb', 'articles', 'noop'],
    queryFn: () => kbApi.article(id!),
    enabled: !!id,
  });
}

export function useKbActions() {
  const qc = useQueryClient();
  return {
    createCategory: useMutation({
      mutationFn: kbApi.createCategory,
      onSuccess: async () => {
        await qc.invalidateQueries({ queryKey: queryKeys.support.kb.categories });
      },
    }),
    createArticle: useMutation({
      mutationFn: kbApi.createArticle,
      onSuccess: async () => {
        await qc.invalidateQueries({ queryKey: ['support', 'kb', 'articles'] });
      },
    }),
    updateArticle: useMutation({
      mutationFn: ({ id, body }: { id: string; body: Parameters<typeof kbApi.updateArticle>[1] }) =>
        kbApi.updateArticle(id, body),
      onSuccess: async () => {
        await qc.invalidateQueries({ queryKey: ['support', 'kb', 'articles'] });
      },
    }),
    archive: useMutation({
      mutationFn: kbApi.archive,
      onSuccess: async () => {
        await qc.invalidateQueries({ queryKey: ['support', 'kb', 'articles'] });
      },
    }),
  };
}

// -------------------------------------------------------- canned responses

export function useCannedResponses(params: Parameters<typeof cannedApi.list>[0] = {}) {
  return useQuery({
    queryKey: queryKeys.support.canned.list(params as Record<string, unknown>),
    queryFn: () => cannedApi.list(params),
  });
}

export function useCannedActions() {
  const qc = useQueryClient();
  return {
    create: useMutation({
      mutationFn: cannedApi.create,
      onSuccess: async () => {
        await qc.invalidateQueries({ queryKey: ['support', 'canned-responses'] });
      },
    }),
    update: useMutation({
      mutationFn: ({ id, body }: { id: string; body: Parameters<typeof cannedApi.update>[1] }) =>
        cannedApi.update(id, body),
      onSuccess: async () => {
        await qc.invalidateQueries({ queryKey: ['support', 'canned-responses'] });
      },
    }),
    delete: useMutation({
      mutationFn: cannedApi.delete,
      onSuccess: async () => {
        await qc.invalidateQueries({ queryKey: ['support', 'canned-responses'] });
      },
    }),
    use: useMutation({ mutationFn: cannedApi.use }),
  };
}

// ---------------------------------------------------------------- SLA

export function useSlaProfiles() {
  return useQuery({ queryKey: queryKeys.support.sla.profiles, queryFn: slaApi.profiles });
}

export function useSlaActions() {
  const qc = useQueryClient();
  return {
    create: useMutation({
      mutationFn: slaApi.createProfile,
      onSuccess: async () => {
        await qc.invalidateQueries({ queryKey: queryKeys.support.sla.profiles });
      },
    }),
    update: useMutation({
      mutationFn: ({ id, body }: { id: string; body: Parameters<typeof slaApi.updateProfile>[1] }) =>
        slaApi.updateProfile(id, body),
      onSuccess: async () => {
        await qc.invalidateQueries({ queryKey: queryKeys.support.sla.profiles });
      },
    }),
    scan: useMutation({ mutationFn: slaApi.scan }),
  };
}

// ----------------------------------------------------------- analytics

export function useSupportOverview(range: { from?: string; to?: string }) {
  return useQuery({
    queryKey: queryKeys.support.analytics.overview(range),
    queryFn: () => supportAnalyticsApi.overview(range),
  });
}

export function useResponseTimes(range: { from?: string; to?: string }) {
  return useQuery({
    queryKey: queryKeys.support.analytics.responseTimes(range),
    queryFn: () => supportAnalyticsApi.responseTimes(range),
  });
}

export function useAgentProductivity(range: { from?: string; to?: string }) {
  return useQuery({
    queryKey: queryKeys.support.analytics.productivity(range),
    queryFn: () => supportAnalyticsApi.productivity(range),
  });
}

export function useChannelBreakdown(range: { from?: string; to?: string }) {
  return useQuery({
    queryKey: queryKeys.support.analytics.channelBreakdown(range),
    queryFn: () => supportAnalyticsApi.channelBreakdown(range),
  });
}

export function useCallCenterStats(range: { from?: string; to?: string }) {
  return useQuery({
    queryKey: queryKeys.support.analytics.callCenter(range),
    queryFn: () => supportAnalyticsApi.callCenter(range),
  });
}

// Re-export types for convenience.
export type {
  CallSummary,
  ConversationSummary,
  ConversationStatus,
  TicketPriority,
  TicketStatus,
  TicketSummary,
};

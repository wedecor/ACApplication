/**
 * Admin CRM ↔ Omnichannel Support API client.
 *
 * Thin typed wrappers around `apiFetch`. The shape of every list response
 * matches the `{ items, meta }` envelope produced by `buildPaginationMeta`
 * on the backend.
 */
import { apiFetch } from './client';

// ---------------------------------------------------------- shared types

export type TicketStatus =
  | 'OPEN'
  | 'PENDING'
  | 'WAITING_CUSTOMER'
  | 'ON_HOLD'
  | 'ESCALATED'
  | 'RESOLVED'
  | 'CLOSED';

export type TicketPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export type TicketSource =
  | 'WHATSAPP'
  | 'EMAIL'
  | 'PHONE'
  | 'WEB_CHAT'
  | 'IN_APP_CHAT'
  | 'SMS'
  | 'WALK_IN'
  | 'SOCIAL'
  | 'MANUAL';

export type ConversationChannel =
  | 'WHATSAPP'
  | 'EMAIL'
  | 'PHONE'
  | 'WEB_CHAT'
  | 'IN_APP_CHAT'
  | 'SMS'
  | 'SOCIAL';

export type ConversationStatus =
  | 'OPEN'
  | 'PENDING'
  | 'WAITING_CUSTOMER'
  | 'RESOLVED'
  | 'CLOSED'
  | 'ARCHIVED';

export type MessageDirection = 'INBOUND' | 'OUTBOUND';
export type MessageStatus = 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';

export type CallDirection = 'INBOUND' | 'OUTBOUND';
export type CallStatus =
  | 'QUEUED'
  | 'RINGING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'MISSED'
  | 'NO_ANSWER'
  | 'BUSY'
  | 'FAILED'
  | 'ABANDONED'
  | 'VOICEMAIL';

export type CallDisposition =
  | 'RESOLVED'
  | 'CALLBACK_REQUESTED'
  | 'WRONG_NUMBER'
  | 'SPAM'
  | 'COMPLAINT'
  | 'BOOKING_CREATED'
  | 'FOLLOWUP_NEEDED'
  | 'NOT_INTERESTED'
  | 'TECHNICAL_ISSUE'
  | 'OTHER';

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedEnvelope<T> {
  items: T[];
  meta: PaginationMeta;
}

// ----------------------------------------------------------- ticket types

export interface TicketSummary {
  id: string;
  number: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  source: TicketSource;
  customerId: string | null;
  bookingId: string | null;
  assignedAgentId: string | null;
  assignedTeam: string | null;
  slaProfileId: string | null;
  firstResponseDueAt: string | null;
  resolutionDueAt: string | null;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  satisfactionRating: number | null;
  escalationLevel: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  customer?: { id: string; fullName: string; phone: string; email: string | null } | null;
  assignedAgent?: { id: string; firstName: string | null; lastName: string | null } | null;
  slaProfile?: { id: string; name: string } | null;
}

export interface TicketActivity {
  id: string;
  type: string;
  fromStatus: TicketStatus | null;
  toStatus: TicketStatus | null;
  message: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  actor?: { id: string; firstName: string | null; lastName: string | null } | null;
}

export interface TicketMessage {
  id: string;
  body: string;
  authorKind: 'CUSTOMER' | 'AGENT' | 'SYSTEM' | 'BOT';
  isInternal: boolean;
  channel: ConversationChannel | null;
  createdAt: string;
  author?: { id: string; firstName: string | null; lastName: string | null } | null;
}

export interface CustomerContext {
  customer: unknown;
  bookings: unknown[];
  amcSubscriptions: unknown[];
  invoices: unknown[];
  payments: unknown[];
  tickets: unknown[];
  valueScore: number;
}

// ---------------------------------------------------------- ticket calls

export interface ListTicketsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: TicketStatus[];
  priority?: TicketPriority[];
  source?: TicketSource[];
  assignedAgentId?: string;
  customerId?: string;
  bookingId?: string;
  tag?: string;
  overdue?: 'true' | 'false';
}

export const ticketsApi = {
  list: (params: ListTicketsParams) =>
    apiFetch<PaginatedEnvelope<TicketSummary>>('/support/tickets', {
      query: params as Record<string, string | number | boolean | string[] | undefined>,
    }),
  detail: (id: string) => apiFetch<TicketSummary>(`/support/tickets/${id}`),
  create: (body: {
    subject: string;
    description?: string;
    customerId?: string;
    bookingId?: string;
    priority?: TicketPriority;
    source?: TicketSource;
    category?: string;
    subcategory?: string;
    tags?: string[];
    assignedAgentId?: string;
    assignedTeam?: string;
    slaProfileId?: string;
  }) => apiFetch<{ id: string; number: string }>('/support/tickets', { method: 'POST', body }),
  update: (id: string, body: Partial<{
    subject: string;
    priority: TicketPriority;
    category: string;
    subcategory: string;
    tags: string[];
    slaProfileId: string;
  }>) => apiFetch<void>(`/support/tickets/${id}`, { method: 'PATCH', body }),
  assign: (id: string, body: { assignedAgentId: string; team?: string }) =>
    apiFetch<void>(`/support/tickets/${id}/assign`, { method: 'POST', body }),
  escalate: (id: string, body: { level?: number; reason?: string; assignToUserId?: string }) =>
    apiFetch<void>(`/support/tickets/${id}/escalate`, { method: 'POST', body }),
  changeStatus: (id: string, body: { status: TicketStatus; reason?: string }) =>
    apiFetch<void>(`/support/tickets/${id}/status`, { method: 'POST', body }),
  resolve: (id: string, reason?: string) =>
    apiFetch<void>(`/support/tickets/${id}/resolve`, { method: 'POST', body: { reason } }),
  close: (id: string, reason?: string) =>
    apiFetch<void>(`/support/tickets/${id}/close`, { method: 'POST', body: { reason } }),
  reopen: (id: string, reason?: string) =>
    apiFetch<void>(`/support/tickets/${id}/reopen`, { method: 'POST', body: { reason } }),
  merge: (id: string, body: { targetTicketId: string }) =>
    apiFetch<void>(`/support/tickets/${id}/merge`, { method: 'POST', body }),
  note: (id: string, body: { body: string; isInternal?: boolean }) =>
    apiFetch<{ messageId: string }>(`/support/tickets/${id}/notes`, { method: 'POST', body }),
  reply: (
    id: string,
    body: {
      body: string;
      channel: ConversationChannel;
      conversationId?: string;
      templateName?: string;
      templateData?: Record<string, unknown>;
    },
  ) => apiFetch<{ messageId: string; conversationMessageId: string | null }>(
    `/support/tickets/${id}/reply`,
    { method: 'POST', body },
  ),
  csat: (id: string, body: { rating: number; comment?: string }) =>
    apiFetch<void>(`/support/tickets/${id}/csat`, { method: 'POST', body }),
  activities: (id: string) =>
    apiFetch<TicketActivity[]>(`/support/tickets/${id}/activities`),
  messages: (id: string) =>
    apiFetch<TicketMessage[]>(`/support/tickets/${id}/messages`),
  customerContext: (id: string) =>
    apiFetch<CustomerContext>(`/support/tickets/${id}/customer-context`),
};

// ------------------------------------------------------- conversations

export interface ConversationSummary {
  id: string;
  channel: ConversationChannel;
  status: ConversationStatus;
  subject: string | null;
  lastMessageAt: string | null;
  unreadAgentCount: number;
  customerId: string | null;
  ticketId: string | null;
  assignedAgentId: string | null;
  customer?: { id: string; fullName: string; phone: string; email: string | null } | null;
  assignedAgent?: { id: string; firstName: string | null; lastName: string | null } | null;
  ticket?: {
    id: string;
    number: string;
    status: TicketStatus;
    priority: TicketPriority;
  } | null;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  direction: MessageDirection;
  authorKind: 'CUSTOMER' | 'AGENT' | 'SYSTEM' | 'BOT';
  body: string;
  channel: ConversationChannel;
  status: MessageStatus;
  externalMessageId: string | null;
  failureReason: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  createdAt: string;
  author?: { id: string; firstName: string | null; lastName: string | null } | null;
}

export interface ListConversationsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: ConversationStatus[];
  channel?: ConversationChannel[];
  assignedAgentId?: string;
  customerId?: string;
  ticketId?: string;
  unread?: 'true' | 'false';
}

export const conversationsApi = {
  list: (params: ListConversationsParams) =>
    apiFetch<PaginatedEnvelope<ConversationSummary>>('/support/inbox/conversations', {
      query: params as Record<string, string | number | boolean | string[] | undefined>,
    }),
  detail: (id: string) =>
    apiFetch<ConversationSummary>(`/support/inbox/conversations/${id}`),
  messages: (id: string, params: { limit?: number; cursor?: string; direction?: MessageDirection }) =>
    apiFetch<{ items: ConversationMessage[]; nextCursor: string | null }>(
      `/support/inbox/conversations/${id}/messages`,
      { query: params as Record<string, string | number | boolean | undefined> },
    ),
  assign: (id: string, body: { assignedAgentId: string }) =>
    apiFetch<void>(`/support/inbox/conversations/${id}/assign`, { method: 'POST', body }),
  send: (
    id: string,
    body: { body: string; channel: ConversationChannel; templateName?: string },
  ) =>
    apiFetch<{ conversationId: string; messageId: string; status: MessageStatus }>(
      `/support/inbox/conversations/${id}/messages`,
      { method: 'POST', body },
    ),
  read: (id: string, body: { lastMessageId?: string } = {}) =>
    apiFetch<void>(`/support/inbox/conversations/${id}/read`, { method: 'POST', body }),
  typing: (id: string, body: { isTyping: boolean }) =>
    apiFetch<void>(`/support/inbox/conversations/${id}/typing`, { method: 'POST', body }),
  close: (id: string) =>
    apiFetch<void>(`/support/inbox/conversations/${id}/close`, { method: 'POST' }),
};

// -------------------------------------------------------------- calls

export interface CallSummary {
  id: string;
  number: string;
  direction: CallDirection;
  status: CallStatus;
  fromNumber: string;
  toNumber: string;
  provider: string;
  queue: string | null;
  disposition: CallDisposition | null;
  startedAt: string;
  answeredAt: string | null;
  endedAt: string | null;
  durationS: number | null;
  customerId: string | null;
  agentUserId: string | null;
  ticketId: string | null;
  customer?: { id: string; fullName: string; phone: string } | null;
  agent?: { id: string; firstName: string | null; lastName: string | null } | null;
  ticket?: { id: string; number: string; status: TicketStatus } | null;
}

export interface ListCallsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: CallStatus[];
  direction?: CallDirection;
  agentUserId?: string;
  customerId?: string;
  ticketId?: string;
  disposition?: CallDisposition[];
  missed?: 'true' | 'false';
}

export const callsApi = {
  list: (params: ListCallsParams) =>
    apiFetch<PaginatedEnvelope<CallSummary>>('/support/calls', {
      query: params as Record<string, string | number | boolean | string[] | undefined>,
    }),
  detail: (id: string) => apiFetch<CallSummary>(`/support/calls/${id}`),
  missedQueue: () => apiFetch<CallSummary[]>('/support/calls/missed-queue'),
  clickToCall: (body: { toNumber: string; customerId?: string; ticketId?: string }) =>
    apiFetch<{ id: string; number: string }>('/support/calls/click-to-call', {
      method: 'POST',
      body,
    }),
  setDisposition: (
    id: string,
    body: { disposition: CallDisposition; notes?: string; followupTicketId?: string },
  ) =>
    apiFetch<void>(`/support/calls/${id}/disposition`, { method: 'POST', body }),
};

// ----------------------------------------------------------- knowledge base

export interface KbCategory {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  parentId: string | null;
  ordering: number;
  isPublic: boolean;
}

export interface KbArticle {
  id: string;
  slug: string;
  title: string;
  bodyMarkdown: string;
  excerpt: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  visibility: 'PUBLIC' | 'INTERNAL' | 'CUSTOMER_AUTHENTICATED';
  categoryId: string | null;
  tags: string[];
  viewCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  category?: { id: string; name: string; slug: string } | null;
}

export const kbApi = {
  categories: () => apiFetch<KbCategory[]>('/support/kb/categories'),
  createCategory: (body: Partial<KbCategory> & { name: string; slug: string }) =>
    apiFetch<{ id: string }>('/support/kb/categories', { method: 'POST', body }),
  articles: (params: { page?: number; pageSize?: number; search?: string; categoryId?: string; status?: KbArticle['status'][]; visibility?: KbArticle['visibility'][]; tag?: string }) =>
    apiFetch<PaginatedEnvelope<KbArticle>>('/support/kb/articles', {
      query: params as Record<string, string | number | boolean | string[] | undefined>,
    }),
  article: (id: string) => apiFetch<KbArticle>(`/support/kb/articles/${id}`),
  createArticle: (body: Partial<KbArticle> & { title: string; slug: string; bodyMarkdown: string }) =>
    apiFetch<{ id: string }>('/support/kb/articles', { method: 'POST', body }),
  updateArticle: (id: string, body: Partial<KbArticle>) =>
    apiFetch<void>(`/support/kb/articles/${id}`, { method: 'PATCH', body }),
  archive: (id: string) =>
    apiFetch<void>(`/support/kb/articles/${id}`, { method: 'DELETE' }),
};

// --------------------------------------------------------- canned responses

export interface CannedResponse {
  id: string;
  code: string;
  title: string;
  body: string;
  scope: 'GLOBAL' | 'TEAM' | 'PRIVATE';
  team: string | null;
  channels: ConversationChannel[];
  tags: string[];
  usageCount: number;
  isActive: boolean;
}

export const cannedApi = {
  list: (params: { page?: number; pageSize?: number; search?: string; channel?: ConversationChannel; tag?: string }) =>
    apiFetch<PaginatedEnvelope<CannedResponse>>('/support/canned-responses', {
      query: params as Record<string, string | number | boolean | undefined>,
    }),
  create: (body: Partial<CannedResponse> & { code: string; title: string; body: string }) =>
    apiFetch<{ id: string }>('/support/canned-responses', { method: 'POST', body }),
  update: (id: string, body: Partial<CannedResponse>) =>
    apiFetch<void>(`/support/canned-responses/${id}`, { method: 'PATCH', body }),
  delete: (id: string) =>
    apiFetch<void>(`/support/canned-responses/${id}`, { method: 'DELETE' }),
  use: (id: string) =>
    apiFetch<void>(`/support/canned-responses/${id}/use`, { method: 'POST' }),
};

// ------------------------------------------------------------------- SLA

export interface SlaProfile {
  id: string;
  name: string;
  description: string | null;
  firstResponseMinutes: number;
  resolutionMinutes: number;
  businessHoursOnly: boolean;
  priorityOverrides: Record<string, { firstResponseMinutes?: number; resolutionMinutes?: number }>;
  isDefault: boolean;
  isActive: boolean;
}

export const slaApi = {
  profiles: () => apiFetch<SlaProfile[]>('/support/sla/profiles'),
  createProfile: (body: Partial<SlaProfile>) =>
    apiFetch<{ id: string }>('/support/sla/profiles', { method: 'POST', body }),
  updateProfile: (id: string, body: Partial<SlaProfile>) =>
    apiFetch<void>(`/support/sla/profiles/${id}`, { method: 'PUT', body }),
  deleteProfile: (id: string) =>
    apiFetch<void>(`/support/sla/profiles/${id}`, { method: 'DELETE' }),
  scan: () => apiFetch<{ warnings: number; breaches: number }>('/support/sla/scan', { method: 'POST' }),
};

// --------------------------------------------------------------- analytics

export interface SupportOverview {
  range: { from: string; to: string };
  totals: { created: number; open: number; resolved: number; resolutionRate: number };
  byPriority: Array<{ priority: TicketPriority; count: number }>;
  byStatus: Array<{ status: TicketStatus; count: number }>;
  bySource: Array<{ source: TicketSource; count: number }>;
  sla: {
    firstResponse: { met: number; missed: number; rate: number };
    resolution: { met: number; missed: number; rate: number };
  };
  csat: { count: number; averageRating: number; promoters: number; detractors: number };
}

export const supportAnalyticsApi = {
  overview: (range: { from?: string; to?: string }) =>
    apiFetch<SupportOverview>('/support/analytics/overview', { query: range }),
  responseTimes: (range: { from?: string; to?: string }) =>
    apiFetch<{
      firstResponseSeconds: { avg: number; p50: number; p90: number };
      resolutionSeconds: { avg: number; p50: number; p90: number };
    }>('/support/analytics/response-times', { query: range }),
  productivity: (range: { from?: string; to?: string }) =>
    apiFetch<
      Array<{
        agentId: string;
        name: string;
        handled: number;
        resolved: number;
        avgResolutionSeconds: number;
      }>
    >('/support/analytics/agent-productivity', { query: range }),
  channelBreakdown: (range: { from?: string; to?: string }) =>
    apiFetch<Record<ConversationChannel, { conversations: number; inbound: number; outbound: number }>>(
      '/support/analytics/channel-breakdown',
      { query: range },
    ),
  callCenter: (range: { from?: string; to?: string }) =>
    apiFetch<{
      total: number;
      missed: number;
      missedRate: number;
      avgDurationSeconds: number;
      byStatus: Array<{ status: CallStatus; count: number }>;
      byDisposition: Array<{ disposition: CallDisposition; count: number }>;
    }>('/support/analytics/call-center', { query: range }),
};

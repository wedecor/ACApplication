import { apiFetch, type PaginatedResponse } from './client';

export const ACCOUNT_TYPES = [
  'RESIDENTIAL_SOCIETY',
  'OFFICE',
  'RETAIL',
  'HOSPITALITY',
  'BUILDER',
  'INSTITUTION',
  'OTHER',
] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const OPPORTUNITY_STAGES = [
  'NEW',
  'QUALIFIED',
  'PROPOSAL',
  'NEGOTIATION',
  'WON',
  'LOST',
] as const;
export type OpportunityStage = (typeof OPPORTUNITY_STAGES)[number];

export const DEFAULT_STAGE_PROBABILITY: Record<OpportunityStage, number> = {
  NEW: 10,
  QUALIFIED: 25,
  PROPOSAL: 50,
  NEGOTIATION: 75,
  WON: 100,
  LOST: 0,
};

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  gstin: string | null;
  billingEmail: string | null;
  phone: string | null;
  ownerUserId: string | null;
  addressLine: string | null;
  cityId: string | null;
  notes: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  _count?: { customers: number; opportunities: number };
}

export interface AccountInput {
  name: string;
  type?: AccountType;
  gstin?: string;
  billingEmail?: string;
  phone?: string;
  ownerUserId?: string;
  addressLine?: string;
  cityId?: string;
  notes?: string;
  tags?: string[];
}

export interface AccountDetail extends Account {
  customers: { id: string; fullName: string; phone: string; email: string | null; totalBookings: number }[];
  stats: {
    customerCount: number;
    bookingCount: number;
    completedBookingCount: number;
    activeAmcCount: number;
    revenueMinor: number;
    outstandingMinor: number;
  };
  recentBookings: {
    id: string;
    code: string;
    status: string;
    category: string;
    scheduledAt: string;
    customerId: string;
    customerName: string;
    finalAmountMinor: number | null;
  }[];
  amcSubscriptions: {
    id: string;
    number: string;
    status: string;
    endsAt: string;
    customerId: string;
    planName: string;
  }[];
  opportunities: { id: string; title: string; stage: OpportunityStage; valueMinor: number }[];
}

export interface AccountListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  type?: AccountType;
}

export interface Opportunity {
  id: string;
  title: string;
  accountId: string | null;
  customerId: string | null;
  leadId: string | null;
  stage: OpportunityStage;
  valueMinor: number;
  probabilityPct: number;
  expectedCloseAt: string | null;
  ownerUserId: string | null;
  lostReason: string | null;
  closedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  account?: { id: string; name: string } | null;
  customer?: { id: string; fullName: string } | null;
  lead?: { id: string; code: string; customerName: string } | null;
}

export interface OpportunityInput {
  title: string;
  accountId?: string;
  customerId?: string;
  leadId?: string;
  stage?: OpportunityStage;
  valueMinor?: number;
  probabilityPct?: number;
  expectedCloseAt?: string;
  ownerUserId?: string;
  notes?: string;
}

export interface OpportunityListQuery {
  page?: number;
  pageSize?: number;
  stage?: OpportunityStage;
  ownerUserId?: string;
  accountId?: string;
  customerId?: string;
  search?: string;
}

export interface PipelineSummary {
  stages: { stage: OpportunityStage; count: number; valueMinor: number; weightedMinor: number }[];
  openCount: number;
  openValueMinor: number;
  weightedForecastMinor: number;
  wonValueMinor: number;
  wonCount: number;
  lostCount: number;
  winRatePct: number;
}

export const salesApi = {
  listAccounts: (query: AccountListQuery = {}) =>
    apiFetch<PaginatedResponse<Account>>('/accounts', { query: query as Record<string, unknown> }),
  getAccount: (id: string) => apiFetch<AccountDetail>(`/accounts/${id}`),
  createAccount: (input: AccountInput) =>
    apiFetch<Account>('/accounts', { method: 'POST', body: input }),
  updateAccount: (id: string, input: Partial<AccountInput>) =>
    apiFetch<Account>(`/accounts/${id}`, { method: 'PATCH', body: input }),
  deleteAccount: (id: string) => apiFetch<unknown>(`/accounts/${id}`, { method: 'DELETE' }),
  linkCustomers: (id: string, customerIds: string[]) =>
    apiFetch<{ linked: number }>(`/accounts/${id}/customers`, {
      method: 'POST',
      body: { customerIds },
    }),
  unlinkCustomer: (id: string, customerId: string) =>
    apiFetch<{ ok: true }>(`/accounts/${id}/customers/${customerId}`, { method: 'DELETE' }),

  listOpportunities: (query: OpportunityListQuery = {}) =>
    apiFetch<PaginatedResponse<Opportunity>>('/opportunities', {
      query: query as Record<string, unknown>,
    }),
  pipeline: (query: { ownerUserId?: string } = {}) =>
    apiFetch<PipelineSummary>('/opportunities/pipeline', { query }),
  getOpportunity: (id: string) => apiFetch<Opportunity>(`/opportunities/${id}`),
  createOpportunity: (input: OpportunityInput) =>
    apiFetch<Opportunity>('/opportunities', { method: 'POST', body: input }),
  createFromLead: (
    leadId: string,
    input: { title?: string; valueMinor?: number; accountId?: string; expectedCloseAt?: string } = {},
  ) =>
    apiFetch<Opportunity>(`/opportunities/from-lead/${leadId}`, { method: 'POST', body: input }),
  updateOpportunity: (id: string, input: Partial<OpportunityInput>) =>
    apiFetch<Opportunity>(`/opportunities/${id}`, { method: 'PATCH', body: input }),
  deleteOpportunity: (id: string) =>
    apiFetch<unknown>(`/opportunities/${id}`, { method: 'DELETE' }),
  moveStage: (id: string, input: { stage: OpportunityStage; lostReason?: string }) =>
    apiFetch<Opportunity>(`/opportunities/${id}/stage`, { method: 'POST', body: input }),
};

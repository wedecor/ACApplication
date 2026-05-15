/**
 * Centralized query-key factory — keep all keys here so cache invalidation
 * stays consistent across mutations.
 */
export const queryKeys = {
  leads: {
    all: ['leads'] as const,
    list: (params: Record<string, unknown>) => ['leads', 'list', params] as const,
    detail: (id: string) => ['leads', 'detail', id] as const,
    notes: (id: string) => ['leads', id, 'notes'] as const,
    activities: (id: string) => ['leads', id, 'activities'] as const,
  },
  customers: {
    all: ['customers'] as const,
    list: (params: Record<string, unknown>) => ['customers', 'list', params] as const,
    detail: (id: string) => ['customers', 'detail', id] as const,
  },
  bookings: {
    all: ['bookings'] as const,
    list: (params: Record<string, unknown>) => ['bookings', 'list', params] as const,
    detail: (id: string) => ['bookings', 'detail', id] as const,
    notes: (id: string) => ['bookings', id, 'notes'] as const,
    activities: (id: string) => ['bookings', id, 'activities'] as const,
    attachments: (id: string) => ['bookings', id, 'attachments'] as const,
  },
  dispatch: {
    unassigned: (cityId: string | null) => ['dispatch', 'unassigned', cityId] as const,
    alerts: (cityId: string | null) => ['dispatch', 'alerts', cityId] as const,
    recommendations: (bookingId: string) => ['dispatch', 'recs', bookingId] as const,
    recentDecisions: (cityId: string | null) => ['dispatch', 'recent', cityId] as const,
  },
  tracking: {
    liveMap: (params: Record<string, unknown>) => ['tracking', 'live-map', params] as const,
    history: (technicianId: string, sinceMinutes: number) =>
      ['tracking', 'history', technicianId, sinceMinutes] as const,
    availability: (cityId: string | null) => ['tracking', 'availability', cityId] as const,
  },
  invoices: {
    all: ['invoices'] as const,
    list: (params: Record<string, unknown>) => ['invoices', 'list', params] as const,
    detail: (id: string) => ['invoices', 'detail', id] as const,
  },
  quotations: {
    all: ['quotations'] as const,
    list: (params: Record<string, unknown>) => ['quotations', 'list', params] as const,
    detail: (id: string) => ['quotations', 'detail', id] as const,
  },
  payments: {
    history: (params: Record<string, unknown>) => ['payments', 'history', params] as const,
  },
  amc: {
    plans: ['amc', 'plans'] as const,
    subscriptions: (params: Record<string, unknown>) =>
      ['amc', 'subscriptions', params] as const,
    subscription: (id: string) => ['amc', 'subscription', id] as const,
  },
  payouts: {
    list: (params: Record<string, unknown>) => ['payouts', 'list', params] as const,
    detail: (id: string) => ['payouts', 'detail', id] as const,
    pending: (technicianId: string) => ['payouts', 'pending', technicianId] as const,
  },
  finance: {
    overview: (range: { from?: string; to?: string }) =>
      ['finance', 'overview', range] as const,
    revenue: (range: { from?: string; to?: string }) =>
      ['finance', 'revenue', range] as const,
    topCustomers: (range: { from?: string; to?: string }) =>
      ['finance', 'top-customers', range] as const,
    byCity: (range: { from?: string; to?: string }) => ['finance', 'by-city', range] as const,
    aging: ['finance', 'aging'] as const,
    payoutPipeline: ['finance', 'payout-pipeline'] as const,
  },
  ledger: {
    statement: (customerId: string) => ['ledger', customerId] as const,
  },
  inventory: {
    items: {
      all: ['inventory', 'items'] as const,
      list: (params: Record<string, unknown>) =>
        ['inventory', 'items', 'list', params] as const,
      detail: (id: string) => ['inventory', 'items', id] as const,
      ledger: (id: string, params: Record<string, unknown>) =>
        ['inventory', 'items', id, 'ledger', params] as const,
    },
    warehouses: {
      all: ['inventory', 'warehouses'] as const,
      list: (params: Record<string, unknown>) =>
        ['inventory', 'warehouses', 'list', params] as const,
      detail: (id: string) => ['inventory', 'warehouses', id] as const,
      stats: (id: string) => ['inventory', 'warehouses', id, 'stats'] as const,
    },
    vendors: {
      all: ['inventory', 'vendors'] as const,
      list: (params: Record<string, unknown>) =>
        ['inventory', 'vendors', 'list', params] as const,
      detail: (id: string) => ['inventory', 'vendors', id] as const,
    },
    purchaseOrders: {
      all: ['inventory', 'purchase-orders'] as const,
      list: (params: Record<string, unknown>) =>
        ['inventory', 'purchase-orders', 'list', params] as const,
      detail: (id: string) => ['inventory', 'purchase-orders', id] as const,
    },
    transfers: {
      all: ['inventory', 'transfers'] as const,
      list: (params: Record<string, unknown>) =>
        ['inventory', 'transfers', 'list', params] as const,
      detail: (id: string) => ['inventory', 'transfers', id] as const,
    },
    alerts: {
      list: (params: Record<string, unknown>) =>
        ['inventory', 'alerts', params] as const,
    },
    analytics: {
      valuation: ['inventory', 'analytics', 'valuation'] as const,
      fastMoving: (params: Record<string, unknown>) =>
        ['inventory', 'analytics', 'fast-moving', params] as const,
      deadStock: (params: Record<string, unknown>) =>
        ['inventory', 'analytics', 'dead-stock', params] as const,
      turnover: (params: Record<string, unknown>) =>
        ['inventory', 'analytics', 'turnover', params] as const,
      procurement: (params: Record<string, unknown>) =>
        ['inventory', 'analytics', 'procurement', params] as const,
      wastage: (params: Record<string, unknown>) =>
        ['inventory', 'analytics', 'wastage', params] as const,
    },
  },
  support: {
    tickets: {
      all: ['support', 'tickets'] as const,
      list: (params: Record<string, unknown>) =>
        ['support', 'tickets', 'list', params] as const,
      detail: (id: string) => ['support', 'tickets', id] as const,
      activities: (id: string) => ['support', 'tickets', id, 'activities'] as const,
      messages: (id: string) => ['support', 'tickets', id, 'messages'] as const,
      customerContext: (id: string) =>
        ['support', 'tickets', id, 'customer-context'] as const,
    },
    inbox: {
      conversations: (params: Record<string, unknown>) =>
        ['support', 'inbox', 'conversations', params] as const,
      detail: (id: string) => ['support', 'inbox', 'conversations', id] as const,
      messages: (id: string, params: Record<string, unknown>) =>
        ['support', 'inbox', 'conversations', id, 'messages', params] as const,
    },
    calls: {
      list: (params: Record<string, unknown>) => ['support', 'calls', 'list', params] as const,
      detail: (id: string) => ['support', 'calls', id] as const,
      missed: ['support', 'calls', 'missed'] as const,
    },
    kb: {
      categories: ['support', 'kb', 'categories'] as const,
      articles: (params: Record<string, unknown>) =>
        ['support', 'kb', 'articles', params] as const,
      article: (id: string) => ['support', 'kb', 'articles', id] as const,
    },
    canned: {
      list: (params: Record<string, unknown>) =>
        ['support', 'canned-responses', params] as const,
    },
    sla: {
      profiles: ['support', 'sla', 'profiles'] as const,
    },
    analytics: {
      overview: (range: { from?: string; to?: string }) =>
        ['support', 'analytics', 'overview', range] as const,
      responseTimes: (range: { from?: string; to?: string }) =>
        ['support', 'analytics', 'response-times', range] as const,
      productivity: (range: { from?: string; to?: string }) =>
        ['support', 'analytics', 'agent-productivity', range] as const,
      channelBreakdown: (range: { from?: string; to?: string }) =>
        ['support', 'analytics', 'channel-breakdown', range] as const,
      callCenter: (range: { from?: string; to?: string }) =>
        ['support', 'analytics', 'call-center', range] as const,
    },
  },
} as const;

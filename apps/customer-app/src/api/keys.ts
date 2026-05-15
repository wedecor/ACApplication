/**
 * React Query keys for the customer app.
 *
 * Centralised so cache invalidation calls cannot drift from the
 * fetcher key shape and so refactors are mechanical.
 */
export const qk = {
  me: () => ['me'] as const,
  bookings: (status?: string) => ['bookings', status ?? 'all'] as const,
  bookingDetail: (id: string) => ['bookings', 'detail', id] as const,
  bookingLocation: (id: string) => ['bookings', 'location', id] as const,
  slots: (category: string, city: string, date: string) =>
    ['bookings', 'slots', category, city, date] as const,

  invoices: () => ['invoices'] as const,
  invoiceDetail: (id: string) => ['invoices', 'detail', id] as const,

  paymentMethods: () => ['payments', 'methods'] as const,
  refunds: () => ['payments', 'refunds'] as const,

  amcPlans: () => ['amc', 'plans'] as const,
  amcMine: () => ['amc', 'mine'] as const,

  notifications: () => ['notifications'] as const,

  supportTickets: () => ['support', 'tickets'] as const,
  supportTicket: (id: string) => ['support', 'tickets', id] as const,
  supportMessages: (id: string) => ['support', 'tickets', id, 'messages'] as const,
  supportFaqs: () => ['support', 'faqs'] as const,

  addresses: () => ['addresses'] as const,
};

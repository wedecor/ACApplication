import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supportApi } from '@/api/endpoints';
import { qk } from '@/api/keys';

export function useSupportTickets() {
  return useQuery({
    queryKey: qk.supportTickets(),
    queryFn: () => supportApi.tickets(),
    staleTime: 30_000,
  });
}

export function useFaqs() {
  return useQuery({
    queryKey: qk.supportFaqs(),
    queryFn: () => supportApi.faqs(),
    staleTime: 30 * 60_000,
  });
}

export function useCreateSupportTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { subject: string; message: string; bookingId?: string }) =>
      supportApi.createTicket(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.supportTickets() }),
  });
}

export function useSupportTicket(id: string | undefined) {
  return useQuery({
    queryKey: id ? qk.supportTicket(id) : ['support', 'tickets', 'noop'],
    queryFn: () => supportApi.ticket(id as string),
    enabled: !!id,
    refetchInterval: 15_000,
  });
}

export function useSupportMessages(id: string | undefined) {
  return useQuery({
    queryKey: id ? qk.supportMessages(id) : ['support', 'tickets', 'noop', 'messages'],
    queryFn: () => supportApi.messages(id as string),
    enabled: !!id,
    refetchInterval: 8_000,
  });
}

export function useSendSupportMessage(id: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => supportApi.sendMessage(id as string, body),
    onSuccess: () => {
      if (id) {
        void qc.invalidateQueries({ queryKey: qk.supportMessages(id) });
        void qc.invalidateQueries({ queryKey: qk.supportTickets() });
      }
    },
  });
}

export function useRateSupportTicket(id: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { rating: number; comment?: string }) =>
      supportApi.rate(id as string, body),
    onSuccess: () => {
      if (id) void qc.invalidateQueries({ queryKey: qk.supportTicket(id) });
      void qc.invalidateQueries({ queryKey: qk.supportTickets() });
    },
  });
}

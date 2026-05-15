import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { bookingsApi } from '@/api/endpoints';
import { qk } from '@/api/keys';
import { track, Events } from '@/lib/analytics';

import { useRealtimeEvent, useRealtimeRoom } from './use-realtime';
import { Rooms, RealtimeEvents } from '@/lib/realtime';

import type { BookingDetail, BookingSummary } from '@/api/types';

export function useBookings(status?: 'active' | 'completed' | 'cancelled') {
  return useQuery({
    queryKey: qk.bookings(status),
    queryFn: () => bookingsApi.list(status),
    staleTime: 30_000,
  });
}

export function useBookingDetail(id: string | undefined) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: id ? qk.bookingDetail(id) : ['bookings', 'detail', 'none'],
    queryFn: () => bookingsApi.detail(id!),
    enabled: !!id,
    staleTime: 15_000,
  });

  useRealtimeRoom(id ? Rooms.booking(id) : null);
  useRealtimeEvent<{ bookingId: string; booking: BookingSummary }>(
    RealtimeEvents.bookingUpdated,
    (payload) => {
      if (!id || payload.bookingId !== id) return;
      qc.setQueryData<BookingDetail | undefined>(qk.bookingDetail(id), (prev) =>
        prev ? { ...prev, ...payload.booking } : prev,
      );
      qc.invalidateQueries({ queryKey: qk.bookings() });
    },
    !!id,
  );
  return query;
}

export function useBookingSlots(input: {
  applianceCategory: string;
  city: string;
  date: string;
} | null) {
  return useQuery({
    queryKey: input ? qk.slots(input.applianceCategory, input.city, input.date) : ['slots', 'none'],
    queryFn: () => bookingsApi.slots(input!),
    enabled: !!input,
    staleTime: 60_000,
  });
}

export function useCreateBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) => bookingsApi.create(input),
    onSuccess: (booking) => {
      qc.invalidateQueries({ queryKey: qk.bookings() });
      qc.setQueryData(qk.bookingDetail(booking.id), booking);
      track(Events.BookingSuccess, { bookingId: booking.id });
    },
    onError: (err: unknown) => {
      track(Events.BookingError, { reason: err instanceof Error ? err.message : 'unknown' });
    },
  });
}

export function useRescheduleBooking(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { scheduledAt: string; reason?: string }) =>
      bookingsApi.reschedule(id, body),
    onSuccess: () => {
      track(Events.BookingReschedule, { bookingId: id });
      qc.invalidateQueries({ queryKey: qk.bookings() });
      qc.invalidateQueries({ queryKey: qk.bookingDetail(id) });
    },
  });
}

export function useCancelBooking(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { reason: string }) => bookingsApi.cancel(id, body),
    onSuccess: () => {
      track(Events.BookingCancel, { bookingId: id });
      qc.invalidateQueries({ queryKey: qk.bookings() });
      qc.invalidateQueries({ queryKey: qk.bookingDetail(id) });
    },
  });
}

export function useRateBooking(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { value: number; comment?: string; photos?: string[] }) =>
      bookingsApi.rate(id, body),
    onSuccess: () => {
      track(Events.ReviewSubmit, { bookingId: id });
      qc.invalidateQueries({ queryKey: qk.bookingDetail(id) });
    },
  });
}

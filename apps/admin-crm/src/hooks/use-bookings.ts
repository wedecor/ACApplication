'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import {
  type BookingListQuery,
  bookingsApi,
  type CreateBookingInput,
  type UpdateBookingInput,
} from '@/lib/api/bookings';
import { queryKeys } from '@/lib/api/query-keys';
import type { BookingStatus } from '@ac/types';

export function useBookings(query: BookingListQuery) {
  return useQuery({
    queryKey: queryKeys.bookings.list(query as Record<string, unknown>),
    queryFn: () => bookingsApi.list(query),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

export function useBooking(id: string | undefined) {
  return useQuery({
    queryKey: id ? queryKeys.bookings.detail(id) : ['bookings', 'detail', 'noop'],
    queryFn: () => bookingsApi.get(id!),
    enabled: !!id,
  });
}

export function useBookingActivities(id: string | undefined) {
  return useQuery({
    queryKey: id ? queryKeys.bookings.activities(id) : ['bookings', 'noop', 'activities'],
    queryFn: () => bookingsApi.listActivities(id!),
    enabled: !!id,
  });
}

export function useBookingNotes(id: string | undefined) {
  return useQuery({
    queryKey: id ? queryKeys.bookings.notes(id) : ['bookings', 'noop', 'notes'],
    queryFn: () => bookingsApi.listNotes(id!),
    enabled: !!id,
  });
}

export function useCreateBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBookingInput) => bookingsApi.create(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.bookings.all });
    },
  });
}

export function useUpdateBooking(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateBookingInput) => bookingsApi.update(id, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.bookings.detail(id) });
      void qc.invalidateQueries({ queryKey: queryKeys.bookings.all });
    },
  });
}

export function useAssignTechnician(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { technicianId?: string; autoPick?: boolean; reason?: string }) =>
      bookingsApi.assignTechnician(id, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.bookings.detail(id) });
      void qc.invalidateQueries({ queryKey: queryKeys.bookings.activities(id) });
      void qc.invalidateQueries({ queryKey: queryKeys.bookings.all });
    },
  });
}

export function useChangeBookingStatus(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { status: BookingStatus; reason?: string; finalAmountMinor?: number }) =>
      bookingsApi.changeStatus(id, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.bookings.detail(id) });
      void qc.invalidateQueries({ queryKey: queryKeys.bookings.activities(id) });
      void qc.invalidateQueries({ queryKey: queryKeys.bookings.all });
    },
  });
}

export function useRescheduleBooking(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { scheduledAt: string; scheduledTimeSlot?: string; reason?: string }) =>
      bookingsApi.reschedule(id, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.bookings.detail(id) });
      void qc.invalidateQueries({ queryKey: queryKeys.bookings.activities(id) });
    },
  });
}

export function useSendBookingOtp(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => bookingsApi.sendOtp(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.bookings.detail(id) });
      void qc.invalidateQueries({ queryKey: queryKeys.bookings.activities(id) });
    },
  });
}

export function useVerifyBookingOtp(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => bookingsApi.verifyOtp(id, code),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.bookings.detail(id) });
      void qc.invalidateQueries({ queryKey: queryKeys.bookings.activities(id) });
    },
  });
}

export function useAddBookingNote(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { body: string; isInternal?: boolean }) =>
      bookingsApi.addNote(id, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.bookings.notes(id) });
      void qc.invalidateQueries({ queryKey: queryKeys.bookings.activities(id) });
    },
  });
}

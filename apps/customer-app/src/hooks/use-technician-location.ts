import { useQuery, useQueryClient } from '@tanstack/react-query';

import { bookingsApi } from '@/api/endpoints';
import { qk } from '@/api/keys';
import { Rooms, RealtimeEvents } from '@/lib/realtime';

import { useRealtimeEvent, useRealtimeRoom } from './use-realtime';

import type { TechnicianLocation } from '@/api/types';

interface LiveLocationState {
  lat: number;
  lng: number;
  bearing?: number | null;
  etaMinutes?: number | null;
  distanceKm?: number | null;
  recordedAt: string;
}

/**
 * Combines REST polling with realtime updates for live technician
 * tracking on the booking detail screen. Realtime is the primary
 * delivery channel; polling kicks in every 30 seconds as a safety net
 * if the socket is disconnected (background, flaky network, etc.).
 */
export function useTechnicianLocation(bookingId: string | undefined) {
  const qc = useQueryClient();
  useRealtimeRoom(bookingId ? Rooms.booking(bookingId) : null);

  useRealtimeEvent<TechnicianLocation>(
    RealtimeEvents.technicianLocation,
    (payload) => {
      if (!bookingId || payload.bookingId !== bookingId) return;
      qc.setQueryData<LiveLocationState | null>(qk.bookingLocation(bookingId), {
        lat: payload.lat,
        lng: payload.lng,
        bearing: payload.bearing ?? null,
        etaMinutes: payload.etaMinutes ?? null,
        distanceKm: payload.distanceKm ?? null,
        recordedAt: payload.recordedAt,
      });
    },
    !!bookingId,
  );

  return useQuery<LiveLocationState | null>({
    queryKey: bookingId ? qk.bookingLocation(bookingId) : ['bookings', 'location', 'none'],
    queryFn: () => bookingsApi.liveLocation(bookingId!),
    enabled: !!bookingId,
    refetchInterval: bookingId ? 30_000 : false,
    refetchIntervalInBackground: false,
  });
}

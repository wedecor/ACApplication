'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';

import { getAccessToken } from '@/lib/api/auth-token';
import { queryKeys } from '@/lib/api/query-keys';
import { env } from '@/env';

type EventHandler = (payload: unknown) => void;

interface UseRealtimeOptions {
  rooms?: string[];
  handlers?: Record<string, EventHandler>;
}

let sharedSocket: Socket | null = null;

/**
 * Returns a shared Socket.io client for the dashboard. Subscribes to the
 * requested rooms on mount, unsubscribes on unmount. The default behaviour
 * is to invalidate React Query caches for any lead/booking domain event so
 * the UI auto-refreshes in real time.
 */
export function useRealtime(options: UseRealtimeOptions = {}): Socket | null {
  const qc = useQueryClient();
  const handlerRef = useRef(options.handlers);
  handlerRef.current = options.handlers;

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    if (!sharedSocket) {
      sharedSocket = io(env.NEXT_PUBLIC_API_URL, {
        path: '/ws',
        transports: ['websocket'],
        auth: { token },
        reconnection: true,
      });
    }
    const socket = sharedSocket;

    const onLeadEvent = () => {
      void qc.invalidateQueries({ queryKey: queryKeys.leads.all });
    };
    const onBookingEvent = () => {
      void qc.invalidateQueries({ queryKey: queryKeys.bookings.all });
    };
    const onDispatchEvent = () => {
      void qc.invalidateQueries({ queryKey: ['dispatch'] });
    };
    const onTrackingEvent = () => {
      // Tracking events fire frequently — let the dispatcher control center
      // handler decide whether to refetch the live-map (typically false; we
      // patch state in-place from the payload).
      void qc.invalidateQueries({ queryKey: ['tracking', 'availability'] });
    };

    socket.onAny((name: string, payload: unknown) => {
      if (name.startsWith('lead.')) onLeadEvent();
      if (name.startsWith('booking.')) onBookingEvent();
      if (name.startsWith('dispatch.')) onDispatchEvent();
      if (name.startsWith('technician.')) onTrackingEvent();
      handlerRef.current?.[name]?.(payload);
    });

    if (options.rooms && options.rooms.length > 0) {
      socket.emit('subscribe', { rooms: options.rooms });
    }

    return () => {
      socket.offAny();
      if (options.rooms && options.rooms.length > 0) {
        socket.emit('unsubscribe', { rooms: options.rooms });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.rooms?.join(','), qc]);

  return sharedSocket;
}

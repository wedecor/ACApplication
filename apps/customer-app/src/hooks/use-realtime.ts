import { useEffect, useState } from 'react';

import { realtime } from '@/lib/realtime';

/**
 * Subscribe to a realtime event for the lifetime of the component.
 */
export function useRealtimeEvent<T = unknown>(
  event: string,
  handler: (payload: T) => void,
  enabled = true,
): void {
  useEffect(() => {
    if (!enabled) return;
    const unsubscribe = realtime.onEvent(event, (p) => handler(p as T));
    return () => unsubscribe();
  }, [event, handler, enabled]);
}

/**
 * Join a realtime room while the component is mounted.
 */
export function useRealtimeRoom(room: string | null | undefined): void {
  useEffect(() => {
    if (!room) return;
    const leave = realtime.joinRoom(room);
    return () => leave();
  }, [room]);
}

/**
 * Boolean connection state. Useful for "Live" indicators in the UI.
 */
export function useRealtimeConnected(): boolean {
  const [connected, setConnected] = useState(realtime.isConnected());
  useEffect(() => {
    const offConnect = realtime.onEvent('connect', () => setConnected(true));
    const offDisconnect = realtime.onEvent('disconnect', () => setConnected(false));
    setConnected(realtime.isConnected());
    const interval = setInterval(() => setConnected(realtime.isConnected()), 5_000);
    return () => {
      offConnect();
      offDisconnect();
      clearInterval(interval);
    };
  }, []);
  return connected;
}

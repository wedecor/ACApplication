import { io, Socket } from 'socket.io-client';

import { config } from '@/config/env';
import { secureStore, SecureKeys } from '@/lib/secure-store';

/**
 * Shared websocket client for the customer app.
 *
 * One socket per app lifetime: when the user logs in we (re)connect with
 * their current access token; when they log out we tear it down. Screens
 * subscribe via {@link onEvent} and never own the socket lifecycle.
 *
 * The server validates the JWT in `handshake.auth.token` and auto-joins
 * the `user:<id>` and `tenant:<id>` rooms. Booking-specific rooms are
 * joined imperatively via the `subscribe` event.
 */
type Listener = (payload: unknown) => void;

class RealtimeClient {
  private socket: Socket | null = null;
  private readonly listeners = new Map<string, Set<Listener>>();
  private joinedRooms = new Set<string>();
  private connecting = false;
  private currentToken: string | null = null;

  async connect(): Promise<void> {
    const token = await secureStore.getItem(SecureKeys.AccessToken);
    if (!token) return;
    if (this.socket?.connected && this.currentToken === token) return;
    if (this.connecting) return;
    this.connecting = true;
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
    }
    this.socket = io(config.wsUrl, {
      path: '/ws',
      transports: ['websocket'],
      auth: { token },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 5_000,
    });
    this.currentToken = token;
    this.socket.on('connect', () => {
      // re-subscribe to any rooms we were in previously
      if (this.joinedRooms.size > 0) {
        this.socket?.emit('subscribe', { rooms: Array.from(this.joinedRooms) });
      }
    });
    this.socket.onAny((event, payload) => {
      const set = this.listeners.get(event);
      if (set) {
        for (const l of set) {
          try {
            l(payload);
          } catch {
            /* swallow */
          }
        }
      }
      const wildcard = this.listeners.get('*');
      if (wildcard) {
        for (const l of wildcard) {
          try {
            l({ event, payload });
          } catch {
            /* swallow */
          }
        }
      }
    });
    this.connecting = false;
  }

  disconnect(): void {
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
    this.currentToken = null;
    this.joinedRooms.clear();
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  onEvent(event: string, listener: Listener): () => void {
    const set = this.listeners.get(event) ?? new Set<Listener>();
    set.add(listener);
    this.listeners.set(event, set);
    return () => {
      set.delete(listener);
      if (set.size === 0) this.listeners.delete(event);
    };
  }

  joinRoom(room: string): () => void {
    this.joinedRooms.add(room);
    if (this.socket?.connected) {
      this.socket.emit('subscribe', { rooms: [room] });
    }
    return () => this.leaveRoom(room);
  }

  leaveRoom(room: string): void {
    this.joinedRooms.delete(room);
    if (this.socket?.connected) {
      this.socket.emit('unsubscribe', { rooms: [room] });
    }
  }
}

export const realtime = new RealtimeClient();

/** Common room name helpers, kept in sync with the API gateway. */
export const Rooms = {
  booking: (id: string) => `booking:${id}`,
  technician: (id: string) => `technician:${id}`,
  customer: (id: string) => `customer:${id}`,
};

/** Well-known events emitted by the realtime gateway. */
export const RealtimeEvents = {
  bookingUpdated: 'booking.updated',
  bookingAssigned: 'booking.assigned',
  technicianLocation: 'technician.location',
  paymentUpdated: 'payment.updated',
  notification: 'notification',
} as const;

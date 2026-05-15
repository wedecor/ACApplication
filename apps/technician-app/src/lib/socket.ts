import { io, type Socket } from 'socket.io-client';

import { API_URL } from './api';
import { getAuthToken } from './auth';

let socket: Socket | null = null;

/**
 * Lazily connect to the realtime gateway with the cached access token. We
 * use a single global socket so the app's screens can attach listeners
 * without churn. The token is read at connect time, so a re-login after a
 * disconnect picks up automatically.
 */
export async function getSocket(): Promise<Socket> {
  if (socket) return socket;
  const token = await getAuthToken();
  socket = io(API_URL, {
    path: '/ws',
    transports: ['websocket'],
    auth: { token: token ?? '' },
    reconnection: true,
    reconnectionDelayMax: 10_000,
  });
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}

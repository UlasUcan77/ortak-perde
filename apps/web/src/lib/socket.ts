import { io, type Socket } from 'socket.io-client';
import type { AckResponse, ClientToServerEvents, ServerToClientEvents } from '@ortak-perde/shared';

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: AppSocket | null = null;

/** One Socket.IO connection per tab, shared by all screens. */
export function getSocket(): AppSocket {
  if (!socket) {
    socket = io({
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 4000,
    });
  }
  return socket;
}

/** Emits an event and resolves with the server's ack (or a timeout error). */
export function emitAck<T = null>(
  event: keyof ClientToServerEvents,
  payload: object = {},
  timeoutMs = 8000,
): Promise<AckResponse<T>> {
  const s = getSocket();
  return new Promise((resolve) => {
    (
      s.timeout(timeoutMs).emit as unknown as (
        e: string,
        p: object,
        cb: (err: Error | null, res: AckResponse<T>) => void,
      ) => void
    )(event, payload, (err, res) => {
      if (err) resolve({ ok: false, error: 'INTERNAL' });
      else resolve(res);
    });
  });
}

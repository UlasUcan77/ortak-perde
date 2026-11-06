import { useCallback, useEffect, useRef, useState } from 'react';
import type { CloseReason, DeckPayload, ErrorCode, RoomView } from '@ortak-perde/shared';
import { getSocket } from './socket';

export type ConnectionStatus = 'connecting' | 'online' | 'offline';

export interface RoomSocketState<V extends RoomView> {
  status: ConnectionStatus;
  view: V | null;
  deck: DeckPayload | null;
  closed: CloseReason | null;
  error: ErrorCode | null;
  setError(error: ErrorCode | null): void;
  /** Forget the current room (e.g. after it was closed). */
  reset(): void;
}

/**
 * Subscribes to the shared socket and keeps the latest room view and deck.
 * `onConnect` runs on every (re)connection and should resume or create the session —
 * this is what makes a locked phone or a page refresh transparently rejoin the room.
 */
export function useRoomSocket<V extends RoomView>(
  onConnect: () => void | Promise<void>,
): RoomSocketState<V> {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [view, setView] = useState<V | null>(null);
  const [deck, setDeck] = useState<DeckPayload | null>(null);
  const [closed, setClosed] = useState<CloseReason | null>(null);
  const [error, setError] = useState<ErrorCode | null>(null);
  const onConnectRef = useRef(onConnect);
  onConnectRef.current = onConnect;

  useEffect(() => {
    const socket = getSocket();
    const handleConnect = () => {
      setStatus('online');
      void onConnectRef.current();
    };
    const handleDisconnect = () => setStatus('offline');
    const handleState = (v: RoomView) => {
      setView(v as V);
      setClosed(null);
    };
    const handleDeck = (d: DeckPayload) => setDeck(d);
    const handleClosed = ({ reason }: { reason: CloseReason }) => {
      setClosed(reason);
      setView(null);
      setDeck(null);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.io.on('reconnect_attempt', handleDisconnect);
    socket.on('room:state', handleState);
    socket.on('game:deck', handleDeck);
    socket.on('room:closed', handleClosed);
    if (socket.connected) handleConnect();
    else socket.connect();

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.io.off('reconnect_attempt', handleDisconnect);
      socket.off('room:state', handleState);
      socket.off('game:deck', handleDeck);
      socket.off('room:closed', handleClosed);
    };
  }, []);

  const reset = useCallback(() => {
    setView(null);
    setDeck(null);
    setClosed(null);
    setError(null);
  }, []);

  return { status, view, deck, closed, error, setError, reset };
}

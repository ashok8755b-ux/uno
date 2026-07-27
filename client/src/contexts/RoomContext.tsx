import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  SOCKET_EVENTS,
  type RoomErrorPayload,
  type RoomNotificationPayload,
  type RoomSettingsPayload,
  type RoomStatePayload,
} from '@online-uno/shared';

import { useAuth } from '@/contexts/AuthContext';
import { connectGameSocket, getGameSocket } from '@/services/socket/client';
import { clearStoredRoomCode, setStoredRoomCode } from '@/utils/roomStorage';

type Ack = { ok: boolean; error?: string };

interface RoomContextValue {
  room: RoomStatePayload | null;
  connected: boolean;
  lastError: string | null;
  lastNotification: RoomNotificationPayload | null;
  createRoom: () => Promise<RoomStatePayload>;
  joinRoom: (code: string) => Promise<RoomStatePayload>;
  rejoinRoom: (code: string) => Promise<void>;
  leaveRoom: () => Promise<void>;
  setReady: (ready: boolean) => Promise<void>;
  updateSettings: (settings: RoomSettingsPayload) => Promise<void>;
  startGame: () => Promise<void>;
  kickPlayer: (targetUid: string) => Promise<void>;
  clearError: () => void;
}

const RoomContext = createContext<RoomContextValue | null>(null);

function emitAck<T extends Ack>(
  event: string,
  payload?: unknown,
): Promise<T> {
  const socket = getGameSocket();
  return new Promise((resolve, reject) => {
    socket.timeout(8000).emit(event, payload ?? {}, (err: Error | null, response: T) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(response);
    });
  });
}

function playerPayload(profile: NonNullable<ReturnType<typeof useAuth>['profile']>) {
  return {
    uid: profile.uid,
    displayName: profile.displayName,
    photoURL: profile.photoURL,
  };
}

export function RoomProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [room, setRoom] = useState<RoomStatePayload | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastNotification, setLastNotification] = useState<RoomNotificationPayload | null>(null);

  useEffect(() => {
    if (!profile) {
      setRoom(null);
      setConnected(false);
      return;
    }

    const socket = connectGameSocket();

    const onConnect = () => {
      setConnected(true);
      const code = sessionStorage.getItem('online_uno_active_room');
      if (code) {
        void emitAck(SOCKET_EVENTS.ROOM_REJOIN, { ...playerPayload(profile), code }).catch(() => {
          clearStoredRoomCode();
        });
      }
    };

    const onDisconnect = () => setConnected(false);

    const onState = (state: RoomStatePayload) => {
      setRoom(state);
      setStoredRoomCode(state.code);
    };

    const onError = (payload: RoomErrorPayload) => {
      setLastError(payload.message);
      if (payload.code === 'KICKED') {
        setRoom(null);
        clearStoredRoomCode();
      }
    };

    const onNotification = (payload: RoomNotificationPayload) => {
      setLastNotification(payload);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on(SOCKET_EVENTS.ROOM_STATE, onState);
    socket.on(SOCKET_EVENTS.ROOM_ERROR, onError);
    socket.on(SOCKET_EVENTS.ROOM_NOTIFICATION, onNotification);

    if (socket.connected) {
      onConnect();
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off(SOCKET_EVENTS.ROOM_STATE, onState);
      socket.off(SOCKET_EVENTS.ROOM_ERROR, onError);
      socket.off(SOCKET_EVENTS.ROOM_NOTIFICATION, onNotification);
    };
  }, [profile]);

  const requireProfile = useCallback(() => {
    if (!profile) throw new Error('Not signed in');
    return profile;
  }, [profile]);

  const createRoom = useCallback(async () => {
    const p = requireProfile();
    connectGameSocket();
    const ack = await emitAck<Ack>(SOCKET_EVENTS.ROOM_CREATE, playerPayload(p));
    if (!ack.ok) throw new Error(ack.error ?? 'Create failed');
    return new Promise<RoomStatePayload>((resolve, reject) => {
      const socket = getGameSocket();
      const timeout = window.setTimeout(() => reject(new Error('Room state timeout')), 5000);
      const handler = (state: RoomStatePayload) => {
        window.clearTimeout(timeout);
        socket.off(SOCKET_EVENTS.ROOM_STATE, handler);
        resolve(state);
      };
      socket.on(SOCKET_EVENTS.ROOM_STATE, handler);
    });
  }, [requireProfile]);

  const joinRoom = useCallback(
    async (code: string) => {
      const p = requireProfile();
      connectGameSocket();
      const normalized = code.trim().toUpperCase();
      const ack = await emitAck<Ack>(SOCKET_EVENTS.ROOM_JOIN, {
        ...playerPayload(p),
        code: normalized,
      });
      if (!ack.ok) throw new Error(ack.error ?? 'Join failed');
      return new Promise<RoomStatePayload>((resolve, reject) => {
        const socket = getGameSocket();
        const timeout = window.setTimeout(() => reject(new Error('Room state timeout')), 5000);
        const handler = (state: RoomStatePayload) => {
          window.clearTimeout(timeout);
          socket.off(SOCKET_EVENTS.ROOM_STATE, handler);
          resolve(state);
        };
        socket.on(SOCKET_EVENTS.ROOM_STATE, handler);
      });
    },
    [requireProfile],
  );

  const rejoinRoom = useCallback(
    async (code: string) => {
      const p = requireProfile();
      const ack = await emitAck<Ack>(SOCKET_EVENTS.ROOM_REJOIN, {
        ...playerPayload(p),
        code: code.trim().toUpperCase(),
      });
      if (!ack.ok) throw new Error(ack.error ?? 'Rejoin failed');
    },
    [requireProfile],
  );

  const leaveRoom = useCallback(async () => {
    await emitAck<Ack>(SOCKET_EVENTS.ROOM_LEAVE);
    setRoom(null);
    clearStoredRoomCode();
  }, []);

  const setReady = useCallback(async (ready: boolean) => {
    const ack = await emitAck<Ack>(SOCKET_EVENTS.ROOM_READY, { ready });
    if (!ack.ok) throw new Error(ack.error ?? 'Ready failed');
  }, []);

  const updateSettings = useCallback(async (settings: RoomSettingsPayload) => {
    const ack = await emitAck<Ack>(SOCKET_EVENTS.ROOM_SETTINGS, settings);
    if (!ack.ok) throw new Error(ack.error ?? 'Settings update failed');
  }, []);

  const startGame = useCallback(async () => {
    const ack = await emitAck<Ack>(SOCKET_EVENTS.ROOM_START);
    if (!ack.ok) throw new Error(ack.error ?? 'Start failed');
  }, []);

  const kickPlayer = useCallback(async (targetUid: string) => {
    const ack = await emitAck<Ack>(SOCKET_EVENTS.ROOM_KICK, { targetUid });
    if (!ack.ok) throw new Error(ack.error ?? 'Kick failed');
  }, []);

  const clearError = useCallback(() => setLastError(null), []);

  const value = useMemo(
    () => ({
      room,
      connected,
      lastError,
      lastNotification,
      createRoom,
      joinRoom,
      rejoinRoom,
      leaveRoom,
      setReady,
      updateSettings,
      startGame,
      kickPlayer,
      clearError,
    }),
    [
      room,
      connected,
      lastError,
      lastNotification,
      createRoom,
      joinRoom,
      rejoinRoom,
      leaveRoom,
      setReady,
      updateSettings,
      startGame,
      kickPlayer,
      clearError,
    ],
  );

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

export function useRoom(): RoomContextValue {
  const ctx = useContext(RoomContext);
  if (!ctx) throw new Error('useRoom must be used within RoomProvider');
  return ctx;
}

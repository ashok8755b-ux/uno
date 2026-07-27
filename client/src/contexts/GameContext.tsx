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
  type GameErrorPayload,
  type GameOverPayload,
  type GameRoundOverPayload,
  type GameStatePayload,
} from '@online-uno/shared';

import { getGameSocket } from '@/services/socket/client';

interface GameContextValue {
  game: GameStatePayload | null;
  lastError: string | null;
  roundOver: GameRoundOverPayload | null;
  gameOver: GameOverPayload | null;
  playCard: (cardId: string, color?: 'red' | 'yellow' | 'green' | 'blue') => Promise<void>;
  drawCard: () => Promise<void>;
  callUno: () => Promise<void>;
  pickColor: (color: 'red' | 'yellow' | 'green' | 'blue') => Promise<void>;
  nextRound: () => Promise<void>;
  clearError: () => void;
  clearRoundOver: () => void;
}

const GameContext = createContext<GameContextValue | null>(null);

type Ack = { ok: boolean; error?: string };

function emitAck<T extends Ack>(event: string, payload?: unknown): Promise<T> {
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

export function GameProvider({ children }: { children: ReactNode }) {
  const [game, setGame] = useState<GameStatePayload | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [roundOver, setRoundOver] = useState<GameRoundOverPayload | null>(null);
  const [gameOver, setGameOver] = useState<GameOverPayload | null>(null);

  useEffect(() => {
    const socket = getGameSocket();

    const onState = (state: GameStatePayload) => {
      setGame(state);
    };

    const onError = (payload: GameErrorPayload) => {
      setLastError(payload.message);
    };

    const onRoundOver = (payload: GameRoundOverPayload) => {
      setRoundOver(payload);
    };

    const onGameOver = (payload: GameOverPayload) => {
      setGameOver(payload);
    };

    socket.on(SOCKET_EVENTS.GAME_STATE, onState);
    socket.on(SOCKET_EVENTS.GAME_ERROR, onError);
    socket.on(SOCKET_EVENTS.GAME_ROUND_OVER, onRoundOver);
    socket.on(SOCKET_EVENTS.GAME_OVER, onGameOver);

    return () => {
      socket.off(SOCKET_EVENTS.GAME_STATE, onState);
      socket.off(SOCKET_EVENTS.GAME_ERROR, onError);
      socket.off(SOCKET_EVENTS.GAME_ROUND_OVER, onRoundOver);
      socket.off(SOCKET_EVENTS.GAME_OVER, onGameOver);
    };
  }, []);

  const playCard = useCallback(async (cardId: string, color?: 'red' | 'yellow' | 'green' | 'blue') => {
    const ack = await emitAck<Ack>(SOCKET_EVENTS.GAME_PLAY, { cardId, color });
    if (!ack.ok) throw new Error(ack.error ?? 'Play failed');
  }, []);

  const drawCard = useCallback(async () => {
    const ack = await emitAck<Ack>(SOCKET_EVENTS.GAME_DRAW);
    if (!ack.ok) throw new Error(ack.error ?? 'Draw failed');
  }, []);

  const callUno = useCallback(async () => {
    const ack = await emitAck<Ack>(SOCKET_EVENTS.GAME_UNO);
    if (!ack.ok) throw new Error(ack.error ?? 'UNO failed');
  }, []);

  const pickColor = useCallback(async (color: 'red' | 'yellow' | 'green' | 'blue') => {
    const ack = await emitAck<Ack>(SOCKET_EVENTS.GAME_PICK_COLOR, { color });
    if (!ack.ok) throw new Error(ack.error ?? 'Color pick failed');
  }, []);

  const nextRound = useCallback(async () => {
    const ack = await emitAck<Ack>(SOCKET_EVENTS.GAME_NEXT_ROUND);
    if (!ack.ok) throw new Error(ack.error ?? 'Next round failed');
    setRoundOver(null);
  }, []);

  const clearError = useCallback(() => setLastError(null), []);
  const clearRoundOver = useCallback(() => setRoundOver(null), []);

  const value = useMemo(
    () => ({
      game,
      lastError,
      roundOver,
      gameOver,
      playCard,
      drawCard,
      callUno,
      pickColor,
      nextRound,
      clearError,
      clearRoundOver,
    }),
    [game, lastError, roundOver, gameOver, playCard, drawCard, callUno, pickColor, nextRound, clearError, clearRoundOver],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) {
    throw new Error('useGame must be used within GameProvider');
  }
  return ctx;
}

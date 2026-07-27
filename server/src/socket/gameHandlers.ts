import type { Server, Socket } from 'socket.io';
import {
  SOCKET_EVENTS,
  type GameErrorPayload,
  type GameOverPayload,
  type GameRoundOverPayload,
  type GameStatePayload,
} from '@online-uno/shared';

import { gameManager } from '../engine/GameManager.js';
import { roomStore } from '../rooms/RoomStore.js';
import { socketRoomName } from '../rooms/validation.js';

function emitGameError(socket: Socket, code: string, message: string): void {
  const payload: GameErrorPayload = { code, message };
  socket.emit(SOCKET_EVENTS.GAME_ERROR, payload);
}

export function broadcastGameState(io: Server, roomCode: string): void {
  const game = gameManager.get(roomCode);
  const room = roomStore.getRoom(roomCode);
  if (!game || !room) return;

  for (const player of room.players.values()) {
    if (!player.connected || !player.socketId) continue;
    const payload: GameStatePayload = game.toPayload(player.uid);
    io.to(player.socketId).emit(SOCKET_EVENTS.GAME_STATE, payload);
  }
}

export function registerGameHandlers(io: Server): void {
  io.on('connection', (socket: Socket) => {
    socket.on(SOCKET_EVENTS.GAME_PLAY, (rawPayload, ack?: (res: { ok: boolean; error?: string }) => void) => {
      const room = roomStore.getRoomBySocket(socket.id);
      const uid = roomStore.getUidForSocket(socket.id);
      if (!room || !uid) {
        emitGameError(socket, 'NOT_IN_ROOM', 'Not in a game.');
        ack?.({ ok: false, error: 'Not in room.' });
        return;
      }

      const game = gameManager.get(room.code);
      if (!game) {
        emitGameError(socket, 'NO_GAME', 'No active game.');
        ack?.({ ok: false, error: 'No game.' });
        return;
      }

      const data = rawPayload as { cardId?: string; color?: string };
      const cardId = data.cardId;
      if (!cardId) {
        emitGameError(socket, 'INVALID_PAYLOAD', 'Missing card ID.');
        ack?.({ ok: false, error: 'Invalid payload.' });
        return;
      }

      const color =
        data.color === 'red' || data.color === 'yellow' || data.color === 'green' || data.color === 'blue'
          ? data.color
          : undefined;

      const result = game.playCard(uid, cardId, color);
      if (!result.ok) {
        emitGameError(socket, 'ILLEGAL_MOVE', result.reason);
        ack?.({ ok: false, error: result.reason });
        return;
      }

      broadcastGameState(io, room.code);

      if (result.roundOver) {
        const roundPayload: GameRoundOverPayload = result.roundOver;
        io.to(socketRoomName(room.code)).emit(SOCKET_EVENTS.GAME_ROUND_OVER, roundPayload);
      }
      if (result.gameOver) {
        const overPayload: GameOverPayload = result.gameOver;
        io.to(socketRoomName(room.code)).emit(SOCKET_EVENTS.GAME_OVER, overPayload);
        room.phase = 'finished';
      }

      ack?.({ ok: true });
    });

    socket.on(
      SOCKET_EVENTS.GAME_PICK_COLOR,
      (rawPayload, ack?: (res: { ok: boolean; error?: string }) => void) => {
        const room = roomStore.getRoomBySocket(socket.id);
        const uid = roomStore.getUidForSocket(socket.id);
        if (!room || !uid) {
          emitGameError(socket, 'NOT_IN_ROOM', 'Not in a game.');
          ack?.({ ok: false, error: 'Not in room.' });
          return;
        }

        const game = gameManager.get(room.code);
        if (!game) {
          emitGameError(socket, 'NO_GAME', 'No active game.');
          ack?.({ ok: false, error: 'No game.' });
          return;
        }

        const color = (rawPayload as { color?: string })?.color;
        if (color !== 'red' && color !== 'yellow' && color !== 'green' && color !== 'blue') {
          emitGameError(socket, 'INVALID_COLOR', 'Invalid color.');
          ack?.({ ok: false, error: 'Invalid color.' });
          return;
        }

        const result = game.pickColor(uid, color);
        if (!result.ok) {
          emitGameError(socket, 'ILLEGAL_MOVE', result.reason);
          ack?.({ ok: false, error: result.reason });
          return;
        }

        broadcastGameState(io, room.code);
        if (result.roundOver) {
          io.to(socketRoomName(room.code)).emit(SOCKET_EVENTS.GAME_ROUND_OVER, result.roundOver);
        }
        if (result.gameOver) {
          io.to(socketRoomName(room.code)).emit(SOCKET_EVENTS.GAME_OVER, result.gameOver);
          room.phase = 'finished';
        }
        ack?.({ ok: true });
      },
    );

    socket.on(SOCKET_EVENTS.GAME_DRAW, (ack?: (res: { ok: boolean; error?: string }) => void) => {
      const room = roomStore.getRoomBySocket(socket.id);
      const uid = roomStore.getUidForSocket(socket.id);
      if (!room || !uid) {
        emitGameError(socket, 'NOT_IN_ROOM', 'Not in a game.');
        ack?.({ ok: false, error: 'Not in room.' });
        return;
      }

      const game = gameManager.get(room.code);
      if (!game) {
        emitGameError(socket, 'NO_GAME', 'No active game.');
        ack?.({ ok: false, error: 'No game.' });
        return;
      }

      const result = game.drawCard(uid);
      if (!result.ok) {
        emitGameError(socket, 'ILLEGAL_MOVE', result.reason);
        ack?.({ ok: false, error: result.reason });
        return;
      }

      broadcastGameState(io, room.code);
      ack?.({ ok: true });
    });

    socket.on(SOCKET_EVENTS.GAME_UNO, (ack?: (res: { ok: boolean; error?: string }) => void) => {
      const room = roomStore.getRoomBySocket(socket.id);
      const uid = roomStore.getUidForSocket(socket.id);
      if (!room || !uid) {
        emitGameError(socket, 'NOT_IN_ROOM', 'Not in a game.');
        ack?.({ ok: false, error: 'Not in room.' });
        return;
      }

      const game = gameManager.get(room.code);
      if (!game) {
        emitGameError(socket, 'NO_GAME', 'No active game.');
        ack?.({ ok: false, error: 'No game.' });
        return;
      }

      const result = game.callUno(uid);
      if (!result.ok) {
        emitGameError(socket, 'ILLEGAL_MOVE', result.reason);
        ack?.({ ok: false, error: result.reason });
        return;
      }

      broadcastGameState(io, room.code);
      ack?.({ ok: true });
    });

    socket.on(SOCKET_EVENTS.GAME_NEXT_ROUND, (ack?: (res: { ok: boolean; error?: string }) => void) => {
      const room = roomStore.getRoomBySocket(socket.id);
      const uid = roomStore.getUidForSocket(socket.id);
      if (!room || !uid) {
        emitGameError(socket, 'NOT_IN_ROOM', 'Not in a room.');
        ack?.({ ok: false, error: 'Not in room.' });
        return;
      }

      if (room.hostId !== uid) {
        emitGameError(socket, 'NOT_HOST', 'Only the host can start the next round.');
        ack?.({ ok: false, error: 'Not host.' });
        return;
      }

      const game = gameManager.get(room.code);
      if (!game) {
        emitGameError(socket, 'NO_GAME', 'No active game.');
        ack?.({ ok: false, error: 'No game.' });
        return;
      }

      const result = game.nextRound();
      if (!result.ok) {
        emitGameError(socket, 'CANNOT_CONTINUE', result.reason);
        ack?.({ ok: false, error: result.reason });
        return;
      }

      room.phase = 'playing';
      broadcastGameState(io, room.code);
      ack?.({ ok: true });
    });
  });
}

export function startGameForRoom(io: Server, roomCode: string): void {
  const room = roomStore.getRoom(roomCode);
  if (!room) return;

  const playerList = [...room.players.values()]
    .sort((a, b) => a.joinOrder - b.joinOrder)
    .map((p) => ({
      id: p.uid,
      displayName: p.displayName,
      photoURL: p.photoURL,
      connected: p.connected,
      score: 0,
    }));

  gameManager.create(roomCode, playerList, {
    turnTimerSec: room.settings.turnTimerSec,
    scoreLimit: room.settings.scoreLimit,
  });

  broadcastGameState(io, roomCode);
}

export function handleGameReconnect(io: Server, roomCode: string, uid: string): void {
  const game = gameManager.get(roomCode);
  if (!game) return;
  game.setPlayerConnected(uid, true);
  broadcastGameState(io, roomCode);
}

export function handleGameDisconnect(roomCode: string, uid: string): void {
  const game = gameManager.get(roomCode);
  if (!game) return;
  game.setPlayerConnected(uid, false);
}

export function cleanupGame(roomCode: string): void {
  gameManager.remove(roomCode);
}

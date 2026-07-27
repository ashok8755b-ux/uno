import type { Server, Socket } from 'socket.io';
import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  SOCKET_EVENTS,
  type RoomErrorPayload,
  type RoomNotificationPayload,
  type RoomSettingsPayload,
  type RoomStatePayload,
} from '@online-uno/shared';

import { roomStore } from '../rooms/RoomStore.js';
import { socketRoomName, validatePlayerPayload } from '../rooms/validation.js';
import {
  broadcastGameState,
  cleanupGame,
  handleGameDisconnect,
  handleGameReconnect,
  startGameForRoom,
} from './gameHandlers.js';

const CLIENT_PUBLIC_URL = process.env.CLIENT_PUBLIC_URL ?? 'http://localhost:5173';

function inviteLink(code: string): string {
  const base = CLIENT_PUBLIC_URL.replace(/\/$/, '');
  return `${base}/join-room?code=${encodeURIComponent(code)}`;
}

function emitError(socket: Socket, code: string, message: string): void {
  const payload: RoomErrorPayload = { code, message };
  socket.emit(SOCKET_EVENTS.ROOM_ERROR, payload);
}

function emitNotification(io: Server, roomCode: string, payload: RoomNotificationPayload): void {
  io.to(socketRoomName(roomCode)).emit(SOCKET_EVENTS.ROOM_NOTIFICATION, {
    ...payload,
    roomCode,
  });
}

function broadcastState(io: Server, roomCode: string): void {
  const room = roomStore.getRoom(roomCode);
  if (!room) return;
  const payload: RoomStatePayload = roomStore.toPayload(room, inviteLink(roomCode));
  io.to(socketRoomName(roomCode)).emit(SOCKET_EVENTS.ROOM_STATE, payload);
}

function removePlayerFromRoom(
  io: Server,
  roomCode: string,
  uid: string,
  reason: RoomNotificationPayload['type'],
): void {
  const room = roomStore.getRoom(roomCode);
  if (!room) return;

  handleGameDisconnect(roomCode, uid);

  const wasHost = room.hostId === uid;
  roomStore.removePlayer(room, uid);

  if (room.players.size === 0) {
    cleanupGame(roomCode);
    roomStore.deleteRoom(roomCode);
    return;
  }

  if (wasHost) {
    const transferred = roomStore.transferHost(room);
    if (transferred) {
      emitNotification(io, roomCode, {
        type: 'host_transferred',
        message: 'Host left. A new host was assigned.',
        playerId: room.hostId,
      });
    }
  }

  const messageMap: Partial<Record<RoomNotificationPayload['type'], string>> = {
    player_left: 'A player left the room.',
    player_kicked: 'A player was removed from the room.',
    player_disconnected: 'A player was removed after disconnect timeout.',
  };

  if (messageMap[reason]) {
    emitNotification(io, roomCode, { type: reason, message: messageMap[reason]!, playerId: uid });
  }

  broadcastState(io, roomCode);
  broadcastGameState(io, roomCode);
}

function handlePlayerDisconnect(io: Server, socket: Socket): void {
  const room = roomStore.getRoomBySocket(socket.id);
  const uid = roomStore.getUidForSocket(socket.id);
  if (!room || !uid) return;

  const player = room.players.get(uid);
  if (!player) return;

  player.connected = false;
  player.isReady = false;
  player.socketId = null;
  roomStore.unbindSocket(socket.id);

  handleGameDisconnect(room.code, uid);

  if (room.hostId === uid) {
    roomStore.transferHost(room);
    emitNotification(io, room.code, {
      type: 'host_transferred',
      message: 'Host disconnected. Temporary host assigned.',
      playerId: room.hostId,
    });
  }

  emitNotification(io, room.code, {
    type: 'player_disconnected',
    message: `${player.displayName} disconnected. Reconnect within 60 seconds.`,
    playerId: uid,
  });

  broadcastState(io, room.code);
  broadcastGameState(io, room.code);

  if (!room.settings.allowReconnect) {
    removePlayerFromRoom(io, room.code, uid, 'player_disconnected');
    return;
  }

  roomStore.scheduleRemoval(room, uid, () => {
    if (!roomStore.getRoom(room.code)) return;
    const current = room.players.get(uid);
    if (!current || current.connected) return;
    removePlayerFromRoom(io, room.code, uid, 'player_disconnected');
  });
}

function joinSocketToRoom(socket: Socket, roomCode: string): void {
  void socket.join(socketRoomName(roomCode));
}

function tryRejoinExisting(
  io: Server,
  socket: Socket,
  room: NonNullable<ReturnType<typeof roomStore.getRoom>>,
  player: NonNullable<ReturnType<typeof validatePlayerPayload>>,
  code: string,
  ack?: (res: { ok: boolean; error?: string }) => void,
): boolean {
  const existing = room.players.get(player.uid);
  if (!existing) return false;

  if (existing.connected && existing.socketId !== socket.id) {
    emitError(socket, 'DUPLICATE_JOIN', 'You are already in this room.');
    ack?.({ ok: false, error: 'Already joined.' });
    return true;
  }

  if (roomStore.isDisplayNameTaken(room, player.displayName, player.uid)) {
    emitError(socket, 'DUPLICATE_NAME', 'That display name is already taken in this room.');
    ack?.({ ok: false, error: 'Name taken.' });
    return true;
  }

  roomStore.bindSocket(room, player.uid, socket.id);
  existing.displayName = player.displayName;
  existing.photoURL = player.photoURL;
  joinSocketToRoom(socket, code);

  if (room.phase === 'playing') {
    handleGameReconnect(io, code, player.uid);
  }

  emitNotification(io, code, {
    type: 'player_reconnected',
    message: `${player.displayName} reconnected.`,
    playerId: player.uid,
  });
  broadcastState(io, code);
  ack?.({ ok: true });
  return true;
}

export function registerRoomHandlers(io: Server): void {
  io.on('connection', (socket: Socket) => {
    socket.on(SOCKET_EVENTS.ROOM_CREATE, (rawPayload, ack?: (res: { ok: boolean; error?: string }) => void) => {
      const player = validatePlayerPayload(rawPayload);
      if (!player) {
        emitError(socket, 'INVALID_PAYLOAD', 'Invalid player data.');
        ack?.({ ok: false, error: 'Invalid player data.' });
        return;
      }

      if (roomStore.getRoomBySocket(socket.id)) {
        emitError(socket, 'ALREADY_IN_ROOM', 'Leave your current room first.');
        ack?.({ ok: false, error: 'Already in a room.' });
        return;
      }

      try {
        const code = roomStore.generateCode();
        const room = roomStore.createRoom(code, {
          uid: player.uid,
          displayName: player.displayName,
          photoURL: player.photoURL,
          socketId: socket.id,
          connected: true,
        });
        joinSocketToRoom(socket, code);
        broadcastState(io, code);
        ack?.({ ok: true });
        emitNotification(io, code, {
          type: 'player_joined',
          message: `${player.displayName} created the room.`,
          playerId: player.uid,
        });
      } catch {
        emitError(socket, 'CREATE_FAILED', 'Could not create room.');
        ack?.({ ok: false, error: 'Could not create room.' });
      }
    });

    socket.on(SOCKET_EVENTS.ROOM_JOIN, (rawPayload, ack?: (res: { ok: boolean; error?: string }) => void) => {
      const data = rawPayload as { code?: string } & Record<string, unknown>;
      const player = validatePlayerPayload(rawPayload);
      const code = typeof data.code === 'string' ? roomStore.normalizeCode(data.code) : null;

      if (!player || !code) {
        emitError(socket, 'INVALID_PAYLOAD', 'Invalid room code or player data.');
        ack?.({ ok: false, error: 'Invalid room or player.' });
        return;
      }

      const room = roomStore.getRoom(code);
      if (!room) {
        emitError(socket, 'ROOM_NOT_FOUND', 'Room not found.');
        ack?.({ ok: false, error: 'Room not found.' });
        return;
      }

      if (room.settings.privateRoom && !room.players.has(player.uid)) {
        emitError(socket, 'ROOM_PRIVATE', 'This room is private.');
        ack?.({ ok: false, error: 'Room is private.' });
        return;
      }

      if (room.phase === 'finished') {
        emitError(socket, 'GAME_ENDED', 'This game has ended.');
        ack?.({ ok: false, error: 'Game ended.' });
        return;
      }

      if (tryRejoinExisting(io, socket, room, player, code, ack)) {
        return;
      }

      if (room.phase !== 'lobby') {
        emitError(socket, 'GAME_STARTED', 'This game has already started.');
        ack?.({ ok: false, error: 'Game already started.' });
        return;
      }

      if (room.players.size >= room.settings.maxPlayers) {
        emitError(socket, 'ROOM_FULL', 'Room is full.');
        ack?.({ ok: false, error: 'Room is full.' });
        return;
      }

      if (roomStore.isDisplayNameTaken(room, player.displayName)) {
        emitError(socket, 'DUPLICATE_NAME', 'That display name is already taken in this room.');
        ack?.({ ok: false, error: 'Name taken.' });
        return;
      }

      if (roomStore.getRoomBySocket(socket.id)) {
        emitError(socket, 'ALREADY_IN_ROOM', 'Leave your current room first.');
        ack?.({ ok: false, error: 'Already in another room.' });
        return;
      }

      roomStore.addOrUpdatePlayer(room, {
        uid: player.uid,
        displayName: player.displayName,
        photoURL: player.photoURL,
        isReady: false,
        socketId: socket.id,
        connected: true,
        joinOrder: room.nextJoinOrder++,
        disconnectTimer: null,
      });
      joinSocketToRoom(socket, code);
      emitNotification(io, code, {
        type: 'player_joined',
        message: `${player.displayName} joined the room.`,
        playerId: player.uid,
      });
      broadcastState(io, code);
      ack?.({ ok: true });
    });

    socket.on(SOCKET_EVENTS.ROOM_REJOIN, (rawPayload, ack?: (res: { ok: boolean; error?: string }) => void) => {
      const data = rawPayload as { code?: string } & Record<string, unknown>;
      const player = validatePlayerPayload(rawPayload);
      const code = typeof data.code === 'string' ? roomStore.normalizeCode(data.code) : null;

      if (!player || !code) {
        emitError(socket, 'INVALID_PAYLOAD', 'Invalid rejoin payload.');
        ack?.({ ok: false, error: 'Invalid rejoin.' });
        return;
      }

      const room = roomStore.getRoom(code);
      if (!room) {
        emitError(socket, 'ROOM_NOT_FOUND', 'Room not found.');
        ack?.({ ok: false, error: 'Room not found.' });
        return;
      }

      if (room.phase === 'finished') {
        emitError(socket, 'GAME_ENDED', 'This game has ended.');
        ack?.({ ok: false, error: 'Game ended.' });
        return;
      }

      const existing = room.players.get(player.uid);
      if (!existing) {
        emitError(socket, 'NOT_IN_ROOM', 'You were not in this room.');
        ack?.({ ok: false, error: 'Not a member.' });
        return;
      }

      if (!room.settings.allowReconnect && room.phase === 'playing') {
        emitError(socket, 'RECONNECT_DISABLED', 'Reconnect is disabled for this room.');
        ack?.({ ok: false, error: 'Reconnect disabled.' });
        return;
      }

      if (roomStore.getRoomBySocket(socket.id)) {
        const currentRoom = roomStore.getRoomBySocket(socket.id);
        if (currentRoom?.code !== code) {
          emitError(socket, 'ALREADY_IN_ROOM', 'Leave your current room first.');
          ack?.({ ok: false, error: 'In another room.' });
          return;
        }
      }

      if (roomStore.isDisplayNameTaken(room, player.displayName, player.uid)) {
        emitError(socket, 'DUPLICATE_NAME', 'That display name is already taken in this room.');
        ack?.({ ok: false, error: 'Name taken.' });
        return;
      }

      roomStore.bindSocket(room, player.uid, socket.id);
      existing.displayName = player.displayName;
      existing.photoURL = player.photoURL;
      joinSocketToRoom(socket, code);

      if (room.phase === 'playing') {
        handleGameReconnect(io, code, player.uid);
      }

      emitNotification(io, code, {
        type: 'player_reconnected',
        message: `${player.displayName} reconnected.`,
        playerId: player.uid,
      });
      broadcastState(io, code);
      ack?.({ ok: true });
    });

    socket.on(SOCKET_EVENTS.ROOM_LEAVE, (ack?: (res: { ok: boolean }) => void) => {
      const room = roomStore.getRoomBySocket(socket.id);
      const uid = roomStore.getUidForSocket(socket.id);
      if (!room || !uid) {
        ack?.({ ok: true });
        return;
      }

      void socket.leave(socketRoomName(room.code));
      removePlayerFromRoom(io, room.code, uid, 'player_left');
      ack?.({ ok: true });
    });

    socket.on(SOCKET_EVENTS.ROOM_READY, (rawPayload, ack?: (res: { ok: boolean; error?: string }) => void) => {
      const room = roomStore.getRoomBySocket(socket.id);
      const uid = roomStore.getUidForSocket(socket.id);
      if (!room || !uid) {
        emitError(socket, 'NOT_IN_ROOM', 'You are not in a room.');
        ack?.({ ok: false, error: 'Not in room.' });
        return;
      }

      if (room.phase !== 'lobby') {
        emitError(socket, 'GAME_STARTED', 'Game already started.');
        ack?.({ ok: false, error: 'Game started.' });
        return;
      }

      const player = room.players.get(uid);
      if (!player || !player.connected) {
        emitError(socket, 'DISCONNECTED', 'Reconnect to change ready status.');
        ack?.({ ok: false, error: 'Disconnected.' });
        return;
      }

      const ready = Boolean((rawPayload as { ready?: boolean })?.ready);
      player.isReady = ready;
      broadcastState(io, room.code);
      ack?.({ ok: true });
    });

    socket.on(
      SOCKET_EVENTS.ROOM_SETTINGS,
      (rawPayload, ack?: (res: { ok: boolean; error?: string }) => void) => {
        const room = roomStore.getRoomBySocket(socket.id);
        const uid = roomStore.getUidForSocket(socket.id);
        if (!room || !uid) {
          emitError(socket, 'NOT_IN_ROOM', 'You are not in a room.');
          ack?.({ ok: false, error: 'Not in room.' });
          return;
        }

        if (room.hostId !== uid) {
          emitError(socket, 'NOT_HOST', 'Only the host can change settings.');
          ack?.({ ok: false, error: 'Not host.' });
          return;
        }

        const partial = rawPayload as RoomSettingsPayload;
        const result = roomStore.updateSettings(room, partial);
        if (!result.ok) {
          emitError(socket, 'INVALID_SETTINGS', result.reason);
          ack?.({ ok: false, error: result.reason });
          return;
        }

        broadcastState(io, room.code);
        emitNotification(io, room.code, {
          type: 'settings_updated',
          message: 'Room settings updated.',
        });
        ack?.({ ok: true });
      },
    );

    socket.on(SOCKET_EVENTS.ROOM_START, (ack?: (res: { ok: boolean; error?: string }) => void) => {
      const room = roomStore.getRoomBySocket(socket.id);
      const uid = roomStore.getUidForSocket(socket.id);
      if (!room || !uid) {
        emitError(socket, 'NOT_IN_ROOM', 'You are not in a room.');
        ack?.({ ok: false, error: 'Not in room.' });
        return;
      }

      if (room.hostId !== uid) {
        emitError(socket, 'NOT_HOST', 'Only the host can start the game.');
        ack?.({ ok: false, error: 'Not host.' });
        return;
      }

      const check = roomStore.canStart(room);
      if (!check.ok) {
        emitError(socket, 'CANNOT_START', check.reason);
        ack?.({ ok: false, error: check.reason });
        return;
      }

      room.phase = 'playing';
      broadcastState(io, room.code);
      startGameForRoom(io, room.code);
      io.to(socketRoomName(room.code)).emit(SOCKET_EVENTS.ROOM_STARTED, { code: room.code });
      ack?.({ ok: true });
    });

    socket.on(SOCKET_EVENTS.ROOM_KICK, (rawPayload, ack?: (res: { ok: boolean; error?: string }) => void) => {
      const room = roomStore.getRoomBySocket(socket.id);
      const uid = roomStore.getUidForSocket(socket.id);
      const targetUid = (rawPayload as { targetUid?: string })?.targetUid;

      if (!room || !uid || !targetUid) {
        emitError(socket, 'INVALID_PAYLOAD', 'Invalid kick request.');
        ack?.({ ok: false, error: 'Invalid kick.' });
        return;
      }

      if (room.hostId !== uid) {
        emitError(socket, 'NOT_HOST', 'Only the host can kick players.');
        ack?.({ ok: false, error: 'Not host.' });
        return;
      }

      if (room.phase !== 'lobby') {
        emitError(socket, 'GAME_STARTED', 'Cannot kick after game start.');
        ack?.({ ok: false, error: 'Game started.' });
        return;
      }

      if (targetUid === uid) {
        emitError(socket, 'INVALID_TARGET', 'You cannot kick yourself.');
        ack?.({ ok: false, error: 'Invalid target.' });
        return;
      }

      if (!room.players.has(targetUid)) {
        emitError(socket, 'NOT_FOUND', 'Player not in room.');
        ack?.({ ok: false, error: 'Player not found.' });
        return;
      }

      const target = room.players.get(targetUid)!;
      if (target.socketId) {
        const targetSocket = io.sockets.sockets.get(target.socketId);
        targetSocket?.leave(socketRoomName(room.code));
        targetSocket?.emit(SOCKET_EVENTS.ROOM_ERROR, {
          code: 'KICKED',
          message: 'You were removed from the room by the host.',
        });
      }

      removePlayerFromRoom(io, room.code, targetUid, 'player_kicked');
      ack?.({ ok: true });
    });

    socket.on('disconnect', () => {
      handlePlayerDisconnect(io, socket);
    });
  });
}

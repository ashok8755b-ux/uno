import {
  DEFAULT_SCORE_LIMIT,
  DEFAULT_TURN_TIMER_SEC,
  MAX_PLAYERS,
  MIN_PLAYERS,
  RECONNECT_TIMEOUT_MS,
  ROOM_CODE_MAX,
  ROOM_CODE_MIN,
  ROOM_CODE_PATTERN,
  type RoomPhase,
  type RoomSettings,
  type RoomStatePayload,
} from '@online-uno/shared';

export interface RoomPlayerInternal {
  uid: string;
  displayName: string;
  photoURL: string | null;
  isReady: boolean;
  socketId: string | null;
  connected: boolean;
  joinOrder: number;
  disconnectTimer: ReturnType<typeof setTimeout> | null;
}

export interface RoomInternal {
  code: string;
  hostId: string;
  phase: RoomPhase;
  players: Map<string, RoomPlayerInternal>;
  nextJoinOrder: number;
  settings: RoomSettings;
}

export function defaultRoomSettings(): RoomSettings {
  return {
    maxPlayers: MAX_PLAYERS,
    turnTimerSec: DEFAULT_TURN_TIMER_SEC,
    allowReconnect: true,
    privateRoom: false,
    scoreLimit: DEFAULT_SCORE_LIMIT,
  };
}

export class RoomStore {
  private readonly rooms = new Map<string, RoomInternal>();
  private readonly socketToRoom = new Map<string, string>();
  private readonly socketToUid = new Map<string, string>();

  generateCode(): string {
    for (let n = ROOM_CODE_MIN; n <= ROOM_CODE_MAX; n += 1) {
      const code = String(n);
      if (!this.rooms.has(code)) {
        return code;
      }
    }
    throw new Error('ROOM_CODE_EXHAUSTED');
  }

  normalizeCode(raw: string): string | null {
    const code = raw.trim();
    if (!ROOM_CODE_PATTERN.test(code)) {
      return null;
    }
    return code;
  }

  isDisplayNameTaken(room: RoomInternal, displayName: string, excludeUid?: string): boolean {
    const normalized = displayName.trim().toLowerCase();
    for (const player of room.players.values()) {
      if (excludeUid && player.uid === excludeUid) continue;
      if (player.displayName.trim().toLowerCase() === normalized) {
        return true;
      }
    }
    return false;
  }

  getRoom(code: string): RoomInternal | undefined {
    return this.rooms.get(code);
  }

  getRoomBySocket(socketId: string): RoomInternal | undefined {
    const code = this.socketToRoom.get(socketId);
    if (!code) return undefined;
    return this.rooms.get(code);
  }

  getUidForSocket(socketId: string): string | undefined {
    return this.socketToUid.get(socketId);
  }

  createRoom(
    code: string,
    host: Omit<RoomPlayerInternal, 'isReady' | 'joinOrder' | 'disconnectTimer' | 'connected'> & {
      connected: boolean;
    },
  ): RoomInternal {
    const room: RoomInternal = {
      code,
      hostId: host.uid,
      phase: 'lobby',
      players: new Map(),
      nextJoinOrder: 0,
      settings: defaultRoomSettings(),
    };
    this.rooms.set(code, room);
    this.addOrUpdatePlayer(room, {
      ...host,
      isReady: false,
      joinOrder: room.nextJoinOrder++,
      disconnectTimer: null,
    });
    return room;
  }

  addOrUpdatePlayer(room: RoomInternal, player: RoomPlayerInternal): void {
    room.players.set(player.uid, player);
    if (player.socketId) {
      this.socketToRoom.set(player.socketId, room.code);
      this.socketToUid.set(player.socketId, player.uid);
    }
  }

  unbindSocket(socketId: string): void {
    this.socketToRoom.delete(socketId);
    this.socketToUid.delete(socketId);
  }

  bindSocket(room: RoomInternal, uid: string, socketId: string): void {
    const player = room.players.get(uid);
    if (!player) return;
    if (player.socketId && player.socketId !== socketId) {
      this.socketToRoom.delete(player.socketId);
      this.socketToUid.delete(player.socketId);
    }
    player.socketId = socketId;
    player.connected = true;
    this.clearDisconnectTimer(player);
    this.socketToRoom.set(socketId, room.code);
    this.socketToUid.set(socketId, uid);
  }

  clearDisconnectTimer(player: RoomPlayerInternal): void {
    if (player.disconnectTimer) {
      clearTimeout(player.disconnectTimer);
      player.disconnectTimer = null;
    }
  }

  removePlayer(room: RoomInternal, uid: string): RoomPlayerInternal | undefined {
    const player = room.players.get(uid);
    if (!player) return undefined;
    this.clearDisconnectTimer(player);
    if (player.socketId) {
      this.socketToRoom.delete(player.socketId);
      this.socketToUid.delete(player.socketId);
    }
    room.players.delete(uid);
    return player;
  }

  deleteRoom(code: string): void {
    const room = this.rooms.get(code);
    if (!room) return;
    for (const player of room.players.values()) {
      this.clearDisconnectTimer(player);
      if (player.socketId) {
        this.socketToRoom.delete(player.socketId);
        this.socketToUid.delete(player.socketId);
      }
    }
    this.rooms.delete(code);
  }

  transferHost(room: RoomInternal): boolean {
    const connected = [...room.players.values()]
      .filter((p) => p.connected)
      .sort((a, b) => a.joinOrder - b.joinOrder);
    const next = connected[0];
    if (!next) {
      return false;
    }
    room.hostId = next.uid;
    return true;
  }

  toPayload(room: RoomInternal, inviteLink: string): RoomStatePayload {
    const players = [...room.players.values()]
      .sort((a, b) => a.joinOrder - b.joinOrder)
      .map((p) => ({
        id: p.uid,
        displayName: p.displayName,
        photoURL: p.photoURL,
        isReady: p.isReady,
        isHost: p.uid === room.hostId,
        connectionStatus: p.connected ? ('connected' as const) : ('disconnected' as const),
      }));

    return {
      code: room.code,
      hostId: room.hostId,
      phase: room.phase,
      players,
      settings: { ...room.settings },
      inviteLink,
    };
  }

  canStart(room: RoomInternal): { ok: true } | { ok: false; reason: string } {
    if (room.phase !== 'lobby') {
      return { ok: false, reason: 'Game already started.' };
    }
    const connected = [...room.players.values()].filter((p) => p.connected);
    if (connected.length < MIN_PLAYERS) {
      return { ok: false, reason: `Need at least ${MIN_PLAYERS} connected players.` };
    }
    if (connected.length > room.settings.maxPlayers) {
      return { ok: false, reason: 'Too many players for room settings.' };
    }
    if (!connected.every((p) => p.isReady)) {
      return { ok: false, reason: 'All connected players must be ready.' };
    }
    return { ok: true };
  }

  updateSettings(
    room: RoomInternal,
    partial: Partial<RoomSettings>,
  ): { ok: true } | { ok: false; reason: string } {
    if (room.phase !== 'lobby') {
      return { ok: false, reason: 'Settings can only be changed in the lobby.' };
    }

    const next = { ...room.settings };

    if (partial.maxPlayers !== undefined) {
      const v = Math.floor(partial.maxPlayers);
      if (v < MIN_PLAYERS || v > MAX_PLAYERS) {
        return { ok: false, reason: `Max players must be ${MIN_PLAYERS}–${MAX_PLAYERS}.` };
      }
      if (room.players.size > v) {
        return { ok: false, reason: 'Too many players already in the room.' };
      }
      next.maxPlayers = v;
    }

    if (partial.turnTimerSec !== undefined) {
      const v = Math.floor(partial.turnTimerSec);
      if (v < 0 || v > 120) {
        return { ok: false, reason: 'Turn timer must be 0–120 seconds.' };
      }
      next.turnTimerSec = v;
    }

    if (partial.allowReconnect !== undefined) {
      next.allowReconnect = Boolean(partial.allowReconnect);
    }

    if (partial.privateRoom !== undefined) {
      next.privateRoom = Boolean(partial.privateRoom);
    }

    if (partial.scoreLimit !== undefined) {
      const v = Math.floor(partial.scoreLimit);
      if (v < 0 || v > 500) {
        return { ok: false, reason: 'Score limit must be 0–500.' };
      }
      next.scoreLimit = v;
    }

    room.settings = next;
    return { ok: true };
  }

  scheduleRemoval(
    room: RoomInternal,
    uid: string,
    onRemove: () => void,
  ): void {
    const player = room.players.get(uid);
    if (!player) return;
    this.clearDisconnectTimer(player);
    player.disconnectTimer = setTimeout(() => {
      player.disconnectTimer = null;
      if (player.connected) return;
      onRemove();
    }, RECONNECT_TIMEOUT_MS);
  }
}

export const roomStore = new RoomStore();

/** Socket event names — keep client and server in sync. */
export const SOCKET_EVENTS = {
  // Room — client → server
  ROOM_CREATE: 'room:create',
  ROOM_JOIN: 'room:join',
  ROOM_REJOIN: 'room:rejoin',
  ROOM_LEAVE: 'room:leave',
  ROOM_READY: 'room:ready',
  ROOM_START: 'room:start',
  ROOM_KICK: 'room:kick',
  ROOM_SETTINGS: 'room:settings',

  // Room — server → client
  ROOM_STATE: 'room:state',
  ROOM_ERROR: 'room:error',
  ROOM_NOTIFICATION: 'room:notification',
  ROOM_STARTED: 'room:started',

  // Game — client → server
  GAME_PLAY: 'game:play',
  GAME_DRAW: 'game:draw',
  GAME_UNO: 'game:uno',
  GAME_PICK_COLOR: 'game:pick-color',
  GAME_NEXT_ROUND: 'game:next-round',

  // Game — server → client
  GAME_STATE: 'game:state',
  GAME_ERROR: 'game:error',
  GAME_OVER: 'game:over',
  GAME_ROUND_OVER: 'game:round-over',
} as const;

export type SocketEventName = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];

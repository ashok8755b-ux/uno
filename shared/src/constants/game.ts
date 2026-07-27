/** Minimum and maximum players per official room rules. */
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 10;

/** Cards dealt to each player at game start. */
export const INITIAL_HAND_SIZE = 7;

/** Default turn timer in seconds (0 = disabled). */
export const DEFAULT_TURN_TIMER_SEC = 30;

/** Room code length for join flow. */
export const ROOM_CODE_LENGTH = 4;

/** Turn timer bounds (seconds). */
export const MIN_TURN_TIMER_SEC = 0;
export const MAX_TURN_TIMER_SEC = 120;

/** Score limit bounds (0 = play until host leaves). */
export const MIN_SCORE_LIMIT = 0;
export const MAX_SCORE_LIMIT = 500;
export const DEFAULT_SCORE_LIMIT = 500;

/** UNO penalty draw count. */
export const UNO_PENALTY_CARDS = 2;

/** Socket namespace path (appended to server URL). */
export const SOCKET_PATH = '/socket.io';

export const APP_NAME = 'Online UNO';

/** Playable card colors (excluding wild). */
export const PLAYABLE_COLORS = ['red', 'yellow', 'green', 'blue'] as const;

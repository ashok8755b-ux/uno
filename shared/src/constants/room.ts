/** Minimum numeric room code (4 digits). */
export const ROOM_CODE_MIN = 1000;

/** Maximum numeric room code (4 digits). */
export const ROOM_CODE_MAX = 9999;

/** Short numeric room codes: 1000–9999. */
export const ROOM_CODE_PATTERN = /^[1-9]\d{3}$/;

export const RECONNECT_TIMEOUT_MS = 60_000;

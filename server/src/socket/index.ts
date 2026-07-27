import type { Server } from 'socket.io';

import { registerGameHandlers } from './gameHandlers.js';
import { registerRoomHandlers } from './roomHandlers.js';

export function registerSocketHandlers(io: Server): void {
  registerRoomHandlers(io);
  registerGameHandlers(io);
}

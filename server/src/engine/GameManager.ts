import { GameEngine, type GamePlayerInternal } from './GameEngine.js';

class GameManager {
  private readonly games = new Map<string, GameEngine>();

  create(
    roomCode: string,
    players: GamePlayerInternal[],
    config: { turnTimerSec: number; scoreLimit: number },
  ): GameEngine {
    const existing = this.games.get(roomCode);
    if (existing) {
      existing.destroy();
    }
    const engine = new GameEngine(roomCode, players, config);
    this.games.set(roomCode, engine);
    return engine;
  }

  get(roomCode: string): GameEngine | undefined {
    return this.games.get(roomCode);
  }

  remove(roomCode: string): void {
    const game = this.games.get(roomCode);
    if (game) {
      game.destroy();
      this.games.delete(roomCode);
    }
  }
}

export const gameManager = new GameManager();

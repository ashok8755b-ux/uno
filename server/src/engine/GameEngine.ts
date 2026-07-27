import {
  INITIAL_HAND_SIZE,
  PLAYABLE_COLORS,
  UNO_PENALTY_CARDS,
  type CardColor,
  type CardValue,
  type GameOverPayload,
  type GamePlayerView,
  type GameRoundOverPayload,
  type GameStatePayload,
  type PlayerId,
  type TurnDirection,
  type UnoCard,
} from '@online-uno/shared';

import { canPlayCard, cardPoints, hasPlayableCard, isWildDrawFourLegal } from './rules.js';

let cardCounter = 0;

function nextCardId(): string {
  cardCounter += 1;
  return `c${Date.now().toString(36)}${cardCounter}`;
}

function createCard(color: CardColor, value: CardValue): UnoCard {
  return { id: nextCardId(), color, value };
}

export function createDeck(): UnoCard[] {
  const deck: UnoCard[] = [];
  for (const color of PLAYABLE_COLORS) {
    deck.push(createCard(color, '0'));
    for (let n = 1; n <= 9; n += 1) {
      const value = String(n) as CardValue;
      deck.push(createCard(color, value));
      deck.push(createCard(color, value));
    }
    for (const value of ['skip', 'reverse', 'draw-two'] as CardValue[]) {
      deck.push(createCard(color, value));
      deck.push(createCard(color, value));
    }
  }
  for (let i = 0; i < 4; i += 1) {
    deck.push(createCard('wild', 'wild'));
    deck.push(createCard('wild', 'wild-draw-four'));
  }
  return deck;
}

export function shuffleDeck(deck: UnoCard[]): UnoCard[] {
  const copy = [...deck];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export interface GamePlayerInternal {
  id: PlayerId;
  displayName: string;
  photoURL: string | null;
  connected: boolean;
  score: number;
}

export interface GameConfig {
  turnTimerSec: number;
  scoreLimit: number;
}

export class GameEngine {
  readonly roomCode: string;
  readonly config: GameConfig;

  phase: 'playing' | 'round-over' | 'game-over' | 'color-pick' = 'playing';
  playerOrder: PlayerId[] = [];
  players = new Map<PlayerId, GamePlayerInternal>();
  hands = new Map<PlayerId, UnoCard[]>();
  drawPile: UnoCard[] = [];
  discardPile: UnoCard[] = [];
  currentPlayerIndex = 0;
  direction: TurnDirection = 1;
  currentColor: CardColor = 'red';
  pendingDraw = 0;
  mustPickColor = false;
  pendingWildCardId: string | null = null;
  drawnCardId: string | null = null;
  canPlayDrawnCard = false;
  unoCalled = new Set<PlayerId>();
  roundNumber = 1;
  winnerId: PlayerId | null = null;
  turnEndsAt: number | null = null;
  turnTimerHandle: ReturnType<typeof setTimeout> | null = null;
  lastAction = '';

  constructor(roomCode: string, playerList: GamePlayerInternal[], config: GameConfig) {
    this.roomCode = roomCode;
    this.config = config;
    for (const p of playerList) {
      this.players.set(p.id, { ...p });
      this.playerOrder.push(p.id);
    }
    this.startRound();
  }

  private startRound(): void {
    this.phase = 'playing';
    this.direction = 1;
    this.pendingDraw = 0;
    this.mustPickColor = false;
    this.pendingWildCardId = null;
    this.drawnCardId = null;
    this.canPlayDrawnCard = false;
    this.unoCalled.clear();
    this.winnerId = null;
    this.clearTurnTimer();

    let deck = shuffleDeck(createDeck());
    for (const uid of this.playerOrder) {
      const hand: UnoCard[] = [];
      for (let i = 0; i < INITIAL_HAND_SIZE; i += 1) {
        if (deck.length === 0) deck = this.reshuffleDrawPile(deck);
        hand.push(deck.pop()!);
      }
      this.hands.set(uid, hand);
    }

    let top = deck.pop()!;
    while (top.value === 'wild-draw-four') {
      deck.push(top);
      deck = shuffleDeck(deck);
      top = deck.pop()!;
    }

    this.discardPile = [top];
    this.currentColor = top.color === 'wild' ? PLAYABLE_COLORS[Math.floor(Math.random() * 4)] : top.color;
    this.drawPile = deck;
    this.currentPlayerIndex = 0;

    if (top.value === 'skip') {
      this.advanceTurn(1);
    } else if (top.value === 'reverse') {
      if (this.playerOrder.length === 2) {
        this.advanceTurn(1);
      } else {
        this.direction = -1;
      }
    } else if (top.value === 'draw-two') {
      this.pendingDraw = 2;
      this.advanceTurn(1);
    }

    this.lastAction = 'Round started.';
    this.startTurnTimer();
  }

  private reshuffleDrawPile(current: UnoCard[]): UnoCard[] {
    if (this.discardPile.length <= 1) return current;
    const top = this.discardPile.pop()!;
    const toShuffle = shuffleDeck(this.discardPile);
    this.discardPile = [top];
    return [...current, ...toShuffle];
  }

  private topDiscard(): UnoCard {
    return this.discardPile[this.discardPile.length - 1];
  }

  private currentPlayerId(): PlayerId {
    return this.playerOrder[this.currentPlayerIndex];
  }

  private clearTurnTimer(): void {
    if (this.turnTimerHandle) {
      clearTimeout(this.turnTimerHandle);
      this.turnTimerHandle = null;
    }
    this.turnEndsAt = null;
  }

  private startTurnTimer(): void {
    this.clearTurnTimer();
    if (this.config.turnTimerSec <= 0 || this.phase !== 'playing') return;
    this.turnEndsAt = Date.now() + this.config.turnTimerSec * 1000;
    this.turnTimerHandle = setTimeout(() => {
      this.handleTurnTimeout();
    }, this.config.turnTimerSec * 1000);
  }

  private handleTurnTimeout(): void {
    if (this.phase !== 'playing') return;
    const uid = this.currentPlayerId();
    if (this.mustPickColor) {
      this.autoPickColor(uid);
      return;
    }
    this.drawCard(uid, true);
  }

  private autoPickColor(uid: PlayerId): void {
    const color = PLAYABLE_COLORS[Math.floor(Math.random() * PLAYABLE_COLORS.length)];
    this.pickColor(uid, color, true);
  }

  private advanceTurn(steps = 1): void {
    const len = this.playerOrder.length;
    this.currentPlayerIndex = (this.currentPlayerIndex + steps * this.direction + len * steps) % len;
    this.unoCalled.clear();
    this.drawnCardId = null;
    this.canPlayDrawnCard = false;
    this.startTurnTimer();
  }

  private nextPlayerId(steps = 1): PlayerId {
    const len = this.playerOrder.length;
    const idx = (this.currentPlayerIndex + steps * this.direction + len * steps) % len;
    return this.playerOrder[idx];
  }

  private drawFromPile(count: number): UnoCard[] {
    const drawn: UnoCard[] = [];
    for (let i = 0; i < count; i += 1) {
      if (this.drawPile.length === 0) {
        this.drawPile = this.reshuffleDrawPile([]);
      }
      if (this.drawPile.length === 0) break;
      drawn.push(this.drawPile.pop()!);
    }
    return drawn;
  }

  private addToHand(uid: PlayerId, cards: UnoCard[]): void {
    const hand = this.hands.get(uid) ?? [];
    this.hands.set(uid, [...hand, ...cards]);
  }

  private removeFromHand(uid: PlayerId, cardId: string): UnoCard | null {
    const hand = this.hands.get(uid);
    if (!hand) return null;
    const idx = hand.findIndex((c) => c.id === cardId);
    if (idx === -1) return null;
    const [card] = hand.splice(idx, 1);
    this.hands.set(uid, hand);
    return card;
  }

  private checkUnoPenalty(uid: PlayerId): void {
    const hand = this.hands.get(uid) ?? [];
    if (hand.length === 1 && !this.unoCalled.has(uid)) {
      const penalty = this.drawFromPile(UNO_PENALTY_CARDS);
      this.addToHand(uid, penalty);
      this.lastAction = `${this.players.get(uid)?.displayName ?? 'Player'} forgot UNO! (+${UNO_PENALTY_CARDS})`;
    }
  }

  private endRound(winnerId: PlayerId): GameRoundOverPayload {
    this.clearTurnTimer();
    this.phase = 'round-over';
    this.winnerId = winnerId;

    const winnerHand = this.hands.get(winnerId) ?? [];
    let roundPoints = 0;
    for (const [uid, hand] of this.hands) {
      if (uid === winnerId) continue;
      for (const card of hand) {
        roundPoints += cardPoints(card);
      }
    }

    const winner = this.players.get(winnerId)!;
    winner.score += roundPoints;

    const scores = this.playerOrder.map((id) => ({
      playerId: id,
      displayName: this.players.get(id)!.displayName,
      score: this.players.get(id)!.score,
    }));

    this.lastAction = `${winner.displayName} won round ${this.roundNumber}!`;

    return {
      roundWinnerId: winnerId,
      roundWinnerName: winner.displayName,
      scores,
      roundNumber: this.roundNumber,
    };
  }

  private checkGameOver(): GameOverPayload | null {
    if (this.config.scoreLimit <= 0) return null;
    for (const uid of this.playerOrder) {
      const p = this.players.get(uid)!;
      if (p.score >= this.config.scoreLimit) {
        this.phase = 'game-over';
        this.winnerId = uid;
        this.clearTurnTimer();
        return {
          winnerId: uid,
          winnerName: p.displayName,
          scores: this.playerOrder.map((id) => ({
            playerId: id,
            displayName: this.players.get(id)!.displayName,
            score: this.players.get(id)!.score,
          })),
          reason: 'score-limit',
        };
      }
    }
    return null;
  }

  drawCard(uid: PlayerId, auto = false): { ok: true } | { ok: false; reason: string } {
    if (this.phase !== 'playing') return { ok: false, reason: 'Game not in progress.' };
    if (uid !== this.currentPlayerId()) return { ok: false, reason: 'Not your turn.' };
    if (this.mustPickColor) return { ok: false, reason: 'Pick a color first.' };

    if (this.pendingDraw > 0) {
      const cards = this.drawFromPile(this.pendingDraw);
      this.addToHand(uid, cards);
      this.pendingDraw = 0;
      this.lastAction = auto
        ? `${this.players.get(uid)?.displayName} timed out and drew ${cards.length}.`
        : `${this.players.get(uid)?.displayName} drew ${cards.length}.`;
      this.advanceTurn(1);
      return { ok: true };
    }

    if (this.drawnCardId && !auto) {
      this.drawnCardId = null;
      this.canPlayDrawnCard = false;
      this.lastAction = `${this.players.get(uid)?.displayName} passed.`;
      this.advanceTurn(1);
      return { ok: true };
    }

    const [card] = this.drawFromPile(1);
    if (!card) return { ok: false, reason: 'Draw pile empty.' };

    const top = this.topDiscard();
    if (canPlayCard(card, top, this.currentColor)) {
      this.drawnCardId = card.id;
      this.canPlayDrawnCard = true;
      this.addToHand(uid, [card]);
      this.lastAction = auto
        ? `${this.players.get(uid)?.displayName} timed out and drew a card.`
        : `${this.players.get(uid)?.displayName} drew a card.`;
      if (auto) {
        this.drawnCardId = null;
        this.canPlayDrawnCard = false;
        this.advanceTurn(1);
      }
    } else {
      this.addToHand(uid, [card]);
      this.lastAction = auto
        ? `${this.players.get(uid)?.displayName} timed out and drew a card.`
        : `${this.players.get(uid)?.displayName} drew a card.`;
      this.advanceTurn(1);
    }

    return { ok: true };
  }

  playCard(
    uid: PlayerId,
    cardId: string,
    chosenColor?: Exclude<CardColor, 'wild'>,
  ):
    | { ok: true; roundOver?: GameRoundOverPayload; gameOver?: GameOverPayload }
    | { ok: false; reason: string } {
    if (this.phase !== 'playing' && this.phase !== 'color-pick') {
      return { ok: false, reason: 'Cannot play now.' };
    }
    if (uid !== this.currentPlayerId()) return { ok: false, reason: 'Not your turn.' };

    const hand = this.hands.get(uid) ?? [];
    const card = hand.find((c) => c.id === cardId);
    if (!card) return { ok: false, reason: 'Card not in hand.' };

    if (this.drawnCardId && cardId !== this.drawnCardId) {
      return { ok: false, reason: 'You must play the drawn card or pass.' };
    }

    const top = this.topDiscard();
    if (!canPlayCard(card, top, this.currentColor)) {
      return { ok: false, reason: 'Illegal card.' };
    }

    if (card.value === 'wild-draw-four' && !isWildDrawFourLegal(hand, this.currentColor)) {
      return { ok: false, reason: 'Wild Draw Four not allowed — you have a matching color.' };
    }

    this.removeFromHand(uid, cardId);
    this.discardPile.push(card);
    this.drawnCardId = null;
    this.canPlayDrawnCard = false;

    const name = this.players.get(uid)?.displayName ?? 'Player';
    this.lastAction = `${name} played ${card.value}.`;

    if (card.color === 'wild') {
      if (!chosenColor) {
        this.mustPickColor = true;
        this.pendingWildCardId = cardId;
        this.phase = 'color-pick';
        this.clearTurnTimer();
        return { ok: true };
      }
      this.currentColor = chosenColor;
      this.mustPickColor = false;
      this.pendingWildCardId = null;
    } else {
      this.currentColor = card.color;
    }

    const remaining = this.hands.get(uid) ?? [];
    if (remaining.length === 0) {
      const roundOver = this.endRound(uid);
      const gameOver = this.checkGameOver();
      return { ok: true, roundOver, gameOver: gameOver ?? undefined };
    }

    if (remaining.length === 1) {
      this.checkUnoPenalty(uid);
    }

    this.applyCardEffect(card);
    return { ok: true };
  }

  pickColor(
    uid: PlayerId,
    color: Exclude<CardColor, 'wild'>,
    auto = false,
  ):
    | { ok: true; roundOver?: GameRoundOverPayload; gameOver?: GameOverPayload }
    | { ok: false; reason: string } {
    if (!this.mustPickColor || uid !== this.currentPlayerId()) {
      return { ok: false, reason: 'No color choice pending.' };
    }
    if (!PLAYABLE_COLORS.includes(color)) {
      return { ok: false, reason: 'Invalid color.' };
    }

    this.currentColor = color;
    this.mustPickColor = false;
    this.phase = 'playing';
    this.pendingWildCardId = null;

    const name = this.players.get(uid)?.displayName ?? 'Player';
    this.lastAction = auto ? `${name}'s color was auto-selected.` : `${name} chose ${color}.`;

    const hand = this.hands.get(uid) ?? [];
    if (hand.length === 0) {
      const roundOver = this.endRound(uid);
      const gameOver = this.checkGameOver();
      return { ok: true, roundOver, gameOver: gameOver ?? undefined };
    }

    if (hand.length === 1) {
      this.checkUnoPenalty(uid);
    }

    const wildCard = this.topDiscard();
    this.applyCardEffect(wildCard);
    return { ok: true };
  }

  private applyCardEffect(card: UnoCard): void {
    switch (card.value) {
      case 'skip':
        this.advanceTurn(2);
        break;
      case 'reverse':
        if (this.playerOrder.length === 2) {
          this.advanceTurn(2);
        } else {
          this.direction = (this.direction * -1) as TurnDirection;
          this.advanceTurn(1);
        }
        break;
      case 'draw-two':
        this.pendingDraw += 2;
        this.advanceTurn(1);
        break;
      case 'wild-draw-four':
        this.pendingDraw += 4;
        this.advanceTurn(1);
        break;
      default:
        this.advanceTurn(1);
        break;
    }
  }

  callUno(uid: PlayerId): { ok: true } | { ok: false; reason: string } {
    const hand = this.hands.get(uid) ?? [];
    if (hand.length !== 1) return { ok: false, reason: 'You can only call UNO with one card.' };
    this.unoCalled.add(uid);
    this.lastAction = `${this.players.get(uid)?.displayName} called UNO!`;
    return { ok: true };
  }

  catchUno(callerUid: PlayerId, targetUid: PlayerId): { ok: true } | { ok: false; reason: string } {
    const hand = this.hands.get(targetUid) ?? [];
    if (hand.length !== 1) return { ok: false, reason: 'Target does not have one card.' };
    if (this.unoCalled.has(targetUid)) return { ok: false, reason: 'Target already called UNO.' };

    const penalty = this.drawFromPile(UNO_PENALTY_CARDS);
    this.addToHand(targetUid, penalty);
    this.lastAction = `${this.players.get(callerUid)?.displayName} caught ${this.players.get(targetUid)?.displayName}! (+${UNO_PENALTY_CARDS})`;
    return { ok: true };
  }

  nextRound(): { ok: true } | { ok: false; reason: string } {
    if (this.phase !== 'round-over') return { ok: false, reason: 'No round to continue.' };
    this.roundNumber += 1;
    for (const uid of this.playerOrder) {
      this.hands.set(uid, []);
    }
    this.startRound();
    return { ok: true };
  }

  setPlayerConnected(uid: PlayerId, connected: boolean): void {
    const p = this.players.get(uid);
    if (p) p.connected = connected;
  }

  removePlayer(uid: PlayerId): void {
    this.playerOrder = this.playerOrder.filter((id) => id !== uid);
    this.players.delete(uid);
    this.hands.delete(uid);
    this.unoCalled.delete(uid);
    if (this.currentPlayerIndex >= this.playerOrder.length) {
      this.currentPlayerIndex = 0;
    }
  }

  getPlayableCards(uid: PlayerId): string[] {
    const hand = this.hands.get(uid) ?? [];
    const top = this.topDiscard();
    return hand.filter((c) => canPlayCard(c, top, this.currentColor)).map((c) => c.id);
  }

  toPayload(viewerId: PlayerId): GameStatePayload {
    const currentId = this.currentPlayerIndex < this.playerOrder.length ? this.currentPlayerId() : '';
    const now = Date.now();
    let turnTimerSec = 0;
    if (this.turnEndsAt && this.config.turnTimerSec > 0) {
      turnTimerSec = Math.max(0, Math.ceil((this.turnEndsAt - now) / 1000));
    }

    const players: GamePlayerView[] = this.playerOrder.map((id) => {
      const p = this.players.get(id)!;
      const hand = this.hands.get(id) ?? [];
      return {
        id,
        displayName: p.displayName,
        photoURL: p.photoURL,
        cardCount: hand.length,
        isCurrentTurn: id === currentId && this.phase === 'playing',
        connectionStatus: p.connected ? 'connected' : 'disconnected',
        score: p.score,
        unoCalled: this.unoCalled.has(id),
      };
    });

    return {
      roomCode: this.roomCode,
      phase: this.phase,
      players,
      myHand: [...(this.hands.get(viewerId) ?? [])],
      topDiscard: this.discardPile.length > 0 ? this.discardPile[this.discardPile.length - 1] : null,
      currentColor: this.currentColor,
      direction: this.direction,
      drawPileCount: this.drawPile.length,
      currentPlayerId: currentId,
      myPlayerId: viewerId,
      pendingDraw: this.pendingDraw,
      mustPickColor: this.mustPickColor && viewerId === currentId,
      canPlayDrawnCard: this.canPlayDrawnCard && viewerId === currentId,
      drawnCardId: this.drawnCardId,
      turnTimerSec,
      turnEndsAt: this.turnEndsAt,
      roundNumber: this.roundNumber,
      winnerId: this.winnerId,
      lastAction: this.lastAction,
    };
  }

  destroy(): void {
    this.clearTurnTimer();
  }
}

export type CardColor = 'red' | 'yellow' | 'green' | 'blue' | 'wild';

export type CardValue =
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | 'skip'
  | 'reverse'
  | 'draw-two'
  | 'wild'
  | 'wild-draw-four';

export interface UnoCard {
  id: string;
  color: CardColor;
  value: CardValue;
}

export type PlayerId = string;
export type RoomCode = string;

export interface PlayerProfileStats {
  displayName: string;
  uid: string;
  photoURL: string | null;
  gamesPlayed: number;
  gamesWon: number;
  winPercentage: number;
  totalScore: number;
  isGuest: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ConnectionStatus = 'connected' | 'disconnected';

export interface RoomPlayer {
  id: PlayerId;
  displayName: string;
  photoURL: string | null;
  isReady: boolean;
  isHost: boolean;
  connectionStatus: ConnectionStatus;
}

export type RoomPhase = 'lobby' | 'playing' | 'finished';

export interface RoomSettings {
  maxPlayers: number;
  turnTimerSec: number;
  allowReconnect: boolean;
  privateRoom: boolean;
  scoreLimit: number;
}

export interface RoomStatePayload {
  code: RoomCode;
  hostId: PlayerId;
  phase: RoomPhase;
  players: RoomPlayer[];
  settings: RoomSettings;
  inviteLink: string;
}

export interface RoomPlayerPayload {
  uid: string;
  displayName: string;
  photoURL: string | null;
}

export interface RoomCreatePayload extends RoomPlayerPayload {}

export interface RoomJoinPayload extends RoomPlayerPayload {
  code: string;
}

export interface RoomRejoinPayload extends RoomPlayerPayload {
  code: string;
}

export interface RoomReadyPayload {
  ready: boolean;
}

export interface RoomKickPayload {
  targetUid: string;
}

export interface RoomSettingsPayload {
  maxPlayers?: number;
  turnTimerSec?: number;
  allowReconnect?: boolean;
  privateRoom?: boolean;
  scoreLimit?: number;
}

export type RoomNotificationType =
  | 'player_joined'
  | 'player_left'
  | 'player_disconnected'
  | 'player_reconnected'
  | 'player_kicked'
  | 'host_transferred'
  | 'settings_updated';

export interface RoomNotificationPayload {
  type: RoomNotificationType;
  message: string;
  playerId?: PlayerId;
  roomCode?: RoomCode;
}

export interface RoomErrorPayload {
  code: string;
  message: string;
}

/** @deprecated Use RoomStatePayload */
export interface RoomSummary {
  code: RoomCode;
  hostId: PlayerId;
  phase: RoomPhase;
  players: RoomPlayer[];
  maxPlayers: number;
}

// ─── Game types ─────────────────────────────────────────────────────────────

export type GamePhase = 'playing' | 'round-over' | 'game-over' | 'color-pick';

export type TurnDirection = 1 | -1;

export interface GamePlayerView {
  id: PlayerId;
  displayName: string;
  photoURL: string | null;
  cardCount: number;
  isCurrentTurn: boolean;
  connectionStatus: ConnectionStatus;
  score: number;
  unoCalled: boolean;
}

export interface GameStatePayload {
  roomCode: RoomCode;
  phase: GamePhase;
  players: GamePlayerView[];
  myHand: UnoCard[];
  topDiscard: UnoCard | null;
  currentColor: CardColor;
  direction: TurnDirection;
  drawPileCount: number;
  currentPlayerId: PlayerId;
  myPlayerId: PlayerId;
  pendingDraw: number;
  mustPickColor: boolean;
  canPlayDrawnCard: boolean;
  drawnCardId: string | null;
  turnTimerSec: number;
  turnEndsAt: number | null;
  roundNumber: number;
  winnerId: PlayerId | null;
  lastAction: string;
}

export interface GamePlayPayload {
  cardId: string;
  color?: Exclude<CardColor, 'wild'>;
}

export interface GamePickColorPayload {
  color: Exclude<CardColor, 'wild'>;
}

export interface GameErrorPayload {
  code: string;
  message: string;
}

export interface GameOverPayload {
  winnerId: PlayerId;
  winnerName: string;
  scores: Array<{ playerId: PlayerId; displayName: string; score: number }>;
  reason: 'score-limit' | 'round-win';
}

export interface GameRoundOverPayload {
  roundWinnerId: PlayerId;
  roundWinnerName: string;
  scores: Array<{ playerId: PlayerId; displayName: string; score: number }>;
  roundNumber: number;
}

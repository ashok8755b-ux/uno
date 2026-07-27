import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

import { UnoCard, CardStack } from '@/components/ui/UnoCard';
import { Button } from '@/components/ui/Button';
import { useGame } from '@/contexts/GameContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRoom } from '@/contexts/RoomContext';
import { soundCardPlay, soundCardDraw, soundUnoCall, soundWildCard } from '@/hooks/useSound';
import { resultPath, ROUTES } from '@/constants/routes';
import type { CardColor, CardValue } from '@/components/ui/UnoCard';
import type { UnoCard as SharedCard } from '@online-uno/shared';

// Map server card values (hyphens) to UnoCard component values (hyphens, same now)
function toDisplayValue(v: string): CardValue {
  // Values match directly since we unified to hyphens
  return v as CardValue;
}

const COLOR_PICK = ['red', 'blue', 'green', 'yellow'] as const;
type PlayableColor = typeof COLOR_PICK[number];

const COLOR_BG: Record<PlayableColor, string> = {
  red: '#e53935', blue: '#1e88e5', green: '#43a047', yellow: '#fb8c00',
};

const COLOR_LABEL: Record<string, string> = {
  red: '🔴 Red', blue: '🔵 Blue', green: '🟢 Green', yellow: '🟡 Yellow',
};

function TurnTimer({ seconds, total }: { seconds: number; total: number }) {
  const pct = total > 0 ? (seconds / total) * 100 : 0;
  const color = seconds <= 5 ? '#ff2d55' : seconds <= 10 ? '#ffd60a' : '#30d158';
  return (
    <div className="relative h-11 w-11">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 44 44">
        <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
        <motion.circle
          cx="22" cy="22" r="18" fill="none" stroke={color} strokeWidth="3"
          strokeLinecap="round"
          style={{ strokeDasharray: '113.1', strokeDashoffset: 113.1 * (1 - pct / 100) }}
          transition={{ duration: 0.5 }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-bold text-white">{seconds}</span>
      </div>
    </div>
  );
}

function ColorPicker({ onPick }: { onPick: (color: PlayableColor) => void }) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
    >
      <motion.div
        className="glass-strong rounded-3xl p-8 text-center"
        initial={{ scale: 0.8, y: 20 }} animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      >
        <p className="mb-5 text-lg font-bold text-white">Choose a color</p>
        <div className="grid grid-cols-2 gap-3">
          {COLOR_PICK.map(c => (
            <motion.button
              key={c}
              onClick={() => onPick(c)}
              className="flex items-center justify-center gap-2 h-14 rounded-2xl border-2 border-white/20 font-bold text-white transition-all"
              style={{ background: COLOR_BG[c], boxShadow: `0 4px 20px ${COLOR_BG[c]}80` }}
              whileHover={{ scale: 1.06, boxShadow: `0 8px 32px ${COLOR_BG[c]}cc` }}
              whileTap={{ scale: 0.95 }}
            >
              {COLOR_LABEL[c]}
            </motion.button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

function RoundOverlay({
  title,
  subtitle,
  scores,
  isHost,
  onNext,
  onHome,
}: {
  title: string;
  subtitle: string;
  scores: Array<{ displayName: string; score: number }>;
  isHost: boolean;
  onNext?: () => void;
  onHome: () => void;
}) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
    >
      <motion.div
        className="glass-strong mx-4 w-full max-w-sm rounded-3xl p-7 text-center"
        initial={{ scale: 0.8, y: 30 }} animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 350, damping: 26 }}
      >
        <p className="mb-1 text-3xl font-black text-white">{title}</p>
        <p className="mb-5 text-sm text-uno-muted">{subtitle}</p>

        {/* Scores */}
        <div className="mb-5 flex flex-col gap-2">
          {scores
            .slice()
            .sort((a, b) => b.score - a.score)
            .map((s, i) => (
              <div key={s.displayName} className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-uno-muted w-4">{i + 1}.</span>
                  <span className="text-sm font-semibold text-white">{s.displayName}</span>
                </div>
                <span className="text-sm font-bold text-uno-yellow">{s.score} pts</span>
              </div>
            ))}
        </div>

        <div className="flex flex-col gap-2">
          {onNext && isHost && (
            <button
              onClick={onNext}
              className="w-full rounded-2xl py-3 font-bold text-white"
              style={{ background: 'linear-gradient(135deg,#c91c31,#e63946)', boxShadow: '0 4px 20px rgba(230,57,70,0.4)' }}
            >
              Next Round →
            </button>
          )}
          {onNext && !isHost && (
            <p className="text-sm text-uno-muted">Waiting for host to start next round…</p>
          )}
          <button
            onClick={onHome}
            className="w-full rounded-2xl py-3 font-bold text-uno-muted hover:text-white transition-colors"
          >
            Leave Game
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function GamePage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { room } = useRoom();
  const {
    game,
    lastError,
    roundOver,
    gameOver,
    playCard,
    drawCard,
    callUno,
    pickColor,
    nextRound,
    clearError,
    clearRoundOver,
  } = useGame();

  const [showColorPick, setShowColorPick] = useState(false);
  const [pendingCardId, setPendingCardId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [unoFlash, setUnoFlash] = useState<string | null>(null);
  const errTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const myUid = profile?.uid ?? '';
  const isHost = room?.hostId === myUid;
  const isMyTurn = game?.currentPlayerId === myUid && game?.phase === 'playing';

  // Auto-show color picker when server says we must pick
  useEffect(() => {
    if (game?.mustPickColor) {
      setShowColorPick(true);
    }
  }, [game?.mustPickColor]);

  // Show errors briefly
  useEffect(() => {
    if (lastError) {
      setLocalError(lastError);
      clearError();
      if (errTimer.current) clearTimeout(errTimer.current);
      errTimer.current = setTimeout(() => setLocalError(null), 3000);
    }
  }, [lastError, clearError]);

  // Navigate to result page when game is over
  useEffect(() => {
    if (gameOver) {
      navigate(resultPath(code ?? ''), { state: { gameOver } });
    }
  }, [gameOver, code, navigate]);

  function showUnoFlash(name: string) {
    setUnoFlash(name);
    setTimeout(() => setUnoFlash(null), 2500);
  }

  function isCardPlayable(card: SharedCard): boolean {
    if (!game || !isMyTurn) return false;
    if (game.mustPickColor) return false;
    if (game.pendingDraw > 0) return false;
    // If we already drew, only that drawn card can be played
    if (game.drawnCardId && card.id !== game.drawnCardId) return false;
    if (!game.canPlayDrawnCard && game.drawnCardId === card.id) return true;
    // Match color or value, or is wild
    if (card.color === 'wild') return true;
    const top = game.topDiscard;
    if (!top) return false;
    return card.color === game.currentColor || card.value === top.value;
  }

  const handleCardClick = async (card: SharedCard) => {
    if (!isCardPlayable(card) || actionLoading) return;
    if (card.color === 'wild') {
      soundWildCard();
      setPendingCardId(card.id);
      setShowColorPick(true);
      return;
    }
    soundCardPlay();
    setActionLoading(true);
    try {
      await playCard(card.id);
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Illegal move');
    } finally {
      setActionLoading(false);
    }
  };

  const handleColorPick = async (color: PlayableColor) => {
    setShowColorPick(false);
    setActionLoading(true);
    try {
      if (pendingCardId) {
        // Playing wild from hand
        await playCard(pendingCardId, color);
        setPendingCardId(null);
      } else {
        // Server-triggered pick (mustPickColor without pending card)
        await pickColor(color);
      }
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Color pick failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDraw = async () => {
    if (!isMyTurn || actionLoading || game?.mustPickColor) return;
    soundCardDraw();
    setActionLoading(true);
    try {
      await drawCard();
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Draw failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUno = async () => {
    if (actionLoading) return;
    soundUnoCall();
    try {
      await callUno();
      showUnoFlash('You');
    } catch {
      // Not an error we surface
    }
  };

  const handleNextRound = async () => {
    try {
      await nextRound();
      clearRoundOver();
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Next round failed');
    }
  };

  const opponents = game?.players.filter(p => p.id !== myUid) ?? [];
  const myHand = game?.myHand ?? [];
  const currentPlayerName = game?.players.find(p => p.id === game.currentPlayerId)?.displayName ?? '';

  if (!game) {
    return (
      <div className="flex min-h-dvh items-center justify-center" style={{ background: '#0a0a0f' }}>
        <div className="text-center">
          <p className="text-uno-muted text-sm mb-3">Connecting to game…</p>
          <div className="h-1 w-32 mx-auto rounded-full bg-white/10 overflow-hidden">
            <motion.div className="h-full bg-uno-red rounded-full" animate={{ x: ['-100%', '100%'] }} transition={{ duration: 1, repeat: Infinity }} />
          </div>
        </div>
      </div>
    );
  }

  const timerTotal = game.turnTimerSec > 0 ? (room?.settings.turnTimerSec ?? game.turnTimerSec) : 30;

  return (
    <div
      className="relative flex min-h-dvh flex-col overflow-hidden select-none"
      style={{ background: 'radial-gradient(ellipse 100% 80% at 50% 0%,rgba(230,57,70,0.07) 0%,transparent 60%), #0a0a0f' }}
    >
      {/* ── Header ── */}
      <header className="glass z-20 flex items-center justify-between px-4 py-2.5 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ background: 'linear-gradient(145deg,#c91c31,#e63946)' }}>
            <span className="text-xs font-black text-white">UNO</span>
          </div>
          {code && (
            <div className="glass rounded-lg px-2.5 py-1 text-xs font-mono font-bold tracking-widest text-white">
              #{code}
            </div>
          )}
          {/* Current color indicator */}
          <div
            className="rounded-lg px-2.5 py-1 text-xs font-bold text-white capitalize"
            style={{ background: `${COLOR_BG[game.currentColor as PlayableColor] ?? '#888'}33`, border: `1px solid ${COLOR_BG[game.currentColor as PlayableColor] ?? '#888'}66` }}
          >
            {game.currentColor}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {game.turnTimerSec > 0 && (
            <TurnTimer seconds={game.turnTimerSec} total={timerTotal} />
          )}
          <Button variant="ghost" size="sm" onClick={() => navigate(ROUTES.home)}>Leave</Button>
        </div>
      </header>

      {/* Error toast */}
      <AnimatePresence>
        {localError && (
          <motion.div
            className="fixed top-16 left-1/2 z-50 -translate-x-1/2 rounded-2xl px-5 py-2.5 text-sm font-medium text-white shadow-xl"
            style={{ background: 'rgba(220,38,38,0.9)', border: '1px solid rgba(255,255,255,0.1)', whiteSpace: 'nowrap' }}
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
          >
            {localError}
          </motion.div>
        )}
      </AnimatePresence>

      {/* UNO flash */}
      <AnimatePresence>
        {unoFlash && (
          <motion.div
            className="fixed top-20 left-1/2 z-50 -translate-x-1/2"
            initial={{ opacity: 0, y: -20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.8 }}
          >
            <div className="rounded-2xl px-6 py-3 text-xl font-black text-white"
              style={{ background: 'linear-gradient(135deg,#c91c31,#e63946)', boxShadow: '0 8px 32px rgba(230,57,70,0.6)' }}>
              🎴 {unoFlash === 'You' ? 'UNO!' : `${unoFlash} says UNO!`}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Opponents ── */}
      <div className="flex flex-wrap justify-center gap-3 px-4 py-3 z-10 shrink-0">
        {opponents.map((p, i) => (
          <motion.div
            key={p.id}
            className={`glass rounded-2xl px-3 py-2 flex flex-col items-center gap-1.5 min-w-[72px] transition-all ${p.isCurrentTurn ? 'ring-1 ring-uno-yellow/50' : ''}`}
            style={{ opacity: p.connectionStatus === 'disconnected' ? 0.5 : 1 }}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: p.connectionStatus === 'disconnected' ? 0.5 : 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
          >
            <div className="flex items-center gap-1.5">
              {p.isCurrentTurn && (
                <motion.div className="h-1.5 w-1.5 rounded-full bg-uno-yellow"
                  animate={{ scale: [1, 1.5, 1] }} transition={{ duration: 0.7, repeat: Infinity }} />
              )}
              <span className="text-xs font-semibold text-white truncate max-w-[72px]">{p.displayName}</span>
              {p.unoCalled && (
                <span className="rounded bg-uno-red px-1 py-0.5 text-[9px] font-black text-white">UNO!</span>
              )}
            </div>
            <CardStack count={p.cardCount} size="xs" />
            <span className="text-[10px] text-uno-muted">{p.score} pts</span>
          </motion.div>
        ))}
      </div>

      {/* ── Game table ── */}
      <div className="flex flex-1 items-center justify-center gap-6 px-4 py-2 min-h-0">
        {/* Draw pile */}
        <div className="flex flex-col items-center gap-1.5">
          <motion.div
            onClick={isMyTurn && !game.mustPickColor ? handleDraw : undefined}
            whileHover={isMyTurn && !game.mustPickColor ? { scale: 1.05 } : undefined}
            whileTap={isMyTurn && !game.mustPickColor ? { scale: 0.95 } : undefined}
            style={{ cursor: isMyTurn && !game.mustPickColor ? 'pointer' : 'default' }}
          >
            <UnoCard color="red" value="back" size="lg" interactive={isMyTurn && !game.mustPickColor} />
          </motion.div>
          <span className="text-xs text-uno-muted font-medium">{game.drawPileCount} left</span>
          {game.pendingDraw > 0 && (
            <span className="text-xs font-bold text-red-400">+{game.pendingDraw}</span>
          )}
        </div>

        {/* Center info */}
        <div className="flex flex-col items-center gap-3">
          {/* Direction */}
          <motion.div
            className="text-2xl"
            animate={{ rotate: game.direction === 1 ? [0, 360] : [0, -360] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
          >
            {game.direction === 1 ? '↻' : '↺'}
          </motion.div>
          <div className="glass rounded-xl px-3 py-1.5 text-center">
            <p className="text-[10px] text-uno-muted uppercase tracking-wide">Turn</p>
            <p className="text-xs font-semibold text-white truncate max-w-[80px]">
              {isMyTurn ? 'You' : currentPlayerName}
            </p>
          </div>
          <p className="text-[10px] text-uno-muted text-center max-w-[90px] leading-tight">
            {game.lastAction}
          </p>
        </div>

        {/* Discard pile */}
        <div className="flex flex-col items-center gap-1.5">
          <AnimatePresence mode="popLayout">
            {game.topDiscard && (
              <motion.div
                key={game.topDiscard.id}
                initial={{ scale: 0.6, rotate: -15, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                exit={{ scale: 1.2, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              >
                <UnoCard
                  color={game.topDiscard.color as CardColor}
                  value={toDisplayValue(game.topDiscard.value)}
                  size="lg"
                />
              </motion.div>
            )}
          </AnimatePresence>
          <span className="text-xs text-uno-muted font-medium">Discard</span>
        </div>
      </div>

      {/* ── Player hand ── */}
      <div className="relative z-10 px-3 pb-3 shrink-0">
        <div className="glass rounded-3xl p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-uno-muted">
              Your hand ({myHand.length})
              {!isMyTurn && <span className="ml-1 text-uno-muted/60">· not your turn</span>}
            </span>
            {isMyTurn && game.drawnCardId && (
              <span className="text-xs text-blue-400">Play drawn card or tap Draw to pass</span>
            )}
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide justify-start md:justify-center flex-wrap">
            <AnimatePresence>
              {myHand.map((card, i) => {
                const playable = isCardPlayable(card);
                const isDrawnCard = card.id === game.drawnCardId;
                return (
                  <motion.div
                    key={card.id}
                    initial={{ scale: 0, y: 40 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0, y: -40, opacity: 0 }}
                    transition={{ delay: Math.min(i * 0.03, 0.3), type: 'spring', stiffness: 400, damping: 30 }}
                  >
                    <UnoCard
                      color={card.color as CardColor}
                      value={toDisplayValue(card.value)}
                      size="md"
                      isPlayable={playable}
                      isSelected={isDrawnCard && !!game.drawnCardId}
                      interactive={playable && !actionLoading}
                      onClick={() => void handleCardClick(card)}
                      style={{ opacity: playable ? 1 : isMyTurn ? 0.4 : 0.6 }}
                    />
                  </motion.div>
                );
              })}
            </AnimatePresence>
            {myHand.length === 0 && (
              <p className="py-4 text-sm text-uno-muted">No cards</p>
            )}
          </div>
        </div>
      </div>

      {/* ── UNO Button ── */}
      <AnimatePresence>
        {myHand.length === 1 && isMyTurn && (
          <motion.button
            className="fixed bottom-32 right-4 z-30 rounded-full font-black text-white shadow-2xl"
            style={{
              width: 68, height: 68, fontSize: 14,
              background: 'linear-gradient(145deg,#c91c31 0%,#e63946 100%)',
            }}
            initial={{ scale: 0, rotate: -180 }}
            animate={{
              scale: 1, rotate: 0,
              boxShadow: [
                '0 0 0 0 rgba(255,45,85,0.7), 0 4px 20px rgba(255,45,85,0.5)',
                '0 0 0 14px rgba(255,45,85,0), 0 4px 20px rgba(255,45,85,0.5)',
                '0 0 0 0 rgba(255,45,85,0.7), 0 4px 20px rgba(255,45,85,0.5)',
              ],
            }}
            exit={{ scale: 0, rotate: 180 }}
            transition={{
              scale: { type: 'spring', stiffness: 400, damping: 20 },
              boxShadow: { duration: 1.5, repeat: Infinity },
            }}
            onClick={handleUno}
            aria-label="Call UNO!"
          >
            UNO!
          </motion.button>
        )}
      </AnimatePresence>

      {/* Color picker modal */}
      {showColorPick && <ColorPicker onPick={handleColorPick} />}

      {/* Round over overlay */}
      {roundOver && !gameOver && (
        <RoundOverlay
          title={`🏆 ${roundOver.roundWinnerName} wins round ${roundOver.roundNumber}!`}
          subtitle="Scores so far"
          scores={roundOver.scores}
          isHost={isHost}
          onNext={isHost ? handleNextRound : undefined}
          onHome={() => navigate(ROUTES.home)}
        />
      )}
    </div>
  );
}

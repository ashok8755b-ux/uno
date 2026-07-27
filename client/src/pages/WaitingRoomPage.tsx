import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

import { Button } from '@/components/ui/Button';
import { UnoCard } from '@/components/ui/UnoCard';
import { useRoom } from '@/contexts/RoomContext';
import { useAuth } from '@/contexts/AuthContext';
import { gamePath, ROUTES } from '@/constants/routes';
import {
  MIN_PLAYERS, MAX_PLAYERS,
  MIN_TURN_TIMER_SEC, MAX_TURN_TIMER_SEC,
  MIN_SCORE_LIMIT, MAX_SCORE_LIMIT,
} from '@online-uno/shared';

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={copy}
      className="ml-2 rounded-lg px-3 py-1 text-xs font-semibold transition-all"
      style={{
        background: copied ? 'rgba(48,209,88,0.2)' : 'rgba(255,255,255,0.08)',
        color: copied ? '#30d158' : '#fff',
        border: `1px solid ${copied ? 'rgba(48,209,88,0.3)' : 'rgba(255,255,255,0.1)'}`,
      }}
    >
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  );
}

const AVATAR_COLORS = ['#e63946', '#1e88e5', '#43a047', '#fb8c00', '#8e24aa', '#00acc1', '#f4511e', '#d81b60', '#1565c0', '#2e7d32'];

export default function WaitingRoomPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { room, lastError, lastNotification, leaveRoom, setReady, updateSettings, startGame, kickPlayer, clearError } = useRoom();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const notifTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const myUid = profile?.uid ?? '';
  const isHost = room?.hostId === myUid;
  const myPlayer = room?.players.find(p => p.id === myUid);
  const isReady = myPlayer?.isReady ?? false;

  const connectedPlayers = room?.players.filter(p => p.connectionStatus === 'connected') ?? [];
  const readyCount = connectedPlayers.filter(p => p.isReady).length;
  const allReady = connectedPlayers.length >= MIN_PLAYERS && connectedPlayers.every(p => p.isReady);

  // Navigate when game starts
  useEffect(() => {
    if (room?.phase === 'playing') {
      navigate(gamePath(room.code));
    }
  }, [room?.phase, room?.code, navigate]);

  // If not in a room, go home
  useEffect(() => {
    if (room === null) {
      // Small delay to avoid flicker on first load
      const t = setTimeout(() => navigate(ROUTES.home), 1000);
      return () => clearTimeout(t);
    }
  }, [room, navigate]);

  // Show notifications
  useEffect(() => {
    if (!lastNotification) return;
    const msg = lastNotification.message;
    setNotification(msg);
    if (notifTimer.current) clearTimeout(notifTimer.current);
    notifTimer.current = setTimeout(() => setNotification(null), 3000);
  }, [lastNotification]);

  // Show server errors
  useEffect(() => {
    if (lastError) {
      setLocalError(lastError);
      clearError();
      const t = setTimeout(() => setLocalError(null), 4000);
      return () => clearTimeout(t);
    }
  }, [lastError, clearError]);

  const run = async (key: string, fn: () => Promise<void>) => {
    setActionLoading(key);
    setLocalError(null);
    try {
      await fn();
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setActionLoading(null);
    }
  };

  const handleLeave = () => run('leave', async () => {
    await leaveRoom();
    navigate(ROUTES.home);
  });

  const handleReady = () => run('ready', () => setReady(!isReady));

  const handleStart = () => run('start', startGame);

  const handleKick = (uid: string) => run(`kick-${uid}`, () => kickPlayer(uid));

  const handleSettingChange = (partial: Parameters<typeof updateSettings>[0]) =>
    run('settings', () => updateSettings(partial));

  if (!room) {
    return (
      <div className="animated-bg flex min-h-dvh items-center justify-center">
        <p className="text-uno-muted text-sm">Returning to home…</p>
      </div>
    );
  }

  const settings = room.settings;

  return (
    <div className="animated-bg flex min-h-dvh flex-col overflow-hidden">
      {/* Header */}
      <motion.header
        className="glass z-10 flex items-center justify-between px-5 py-3"
        initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ background: 'linear-gradient(145deg,#c91c31,#e63946)' }}>
            <span className="text-xs font-black text-white">UNO</span>
          </div>
          <span className="font-semibold text-white">Lobby</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLeave}
          disabled={actionLoading === 'leave'}
        >
          {actionLoading === 'leave' ? 'Leaving…' : 'Leave'}
        </Button>
      </motion.header>

      {/* Notification toast */}
      <AnimatePresence>
        {notification && (
          <motion.div
            className="fixed top-16 left-1/2 z-50 -translate-x-1/2 rounded-2xl px-5 py-2.5 text-sm font-medium text-white shadow-xl"
            style={{ background: 'rgba(30,30,40,0.95)', border: '1px solid rgba(255,255,255,0.1)', whiteSpace: 'nowrap' }}
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
          >
            {notification}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error banner */}
      <AnimatePresence>
        {localError && (
          <motion.div
            className="mx-4 mt-3 rounded-xl bg-red-500/10 px-4 py-2 text-sm text-red-400 border border-red-500/20"
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
          >
            {localError}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-1 flex-col items-center justify-start gap-4 px-4 py-6 max-w-lg mx-auto w-full">

        {/* Room code */}
        <motion.div
          className="glass-strong w-full rounded-3xl p-5 text-center"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-uno-muted mb-2">Room Code</p>
          <div className="flex items-center justify-center gap-2">
            <span
              className="text-4xl font-black tracking-[0.2em] text-white"
              style={{ textShadow: '0 0 20px rgba(230,57,70,0.5)' }}
            >
              {room.code}
            </span>
            <CopyButton text={room.code} />
          </div>
          <div className="mt-2 flex items-center justify-center gap-2">
            <p className="text-xs text-uno-muted">Invite link:</p>
            <CopyButton text={room.inviteLink} />
          </div>
        </motion.div>

        {/* Players list */}
        <motion.div
          className="glass w-full rounded-3xl p-5"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white">Players</h2>
            <span className="text-xs text-uno-muted">
              {room.players.length} / {settings.maxPlayers}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            <AnimatePresence>
              {room.players.map((p, i) => {
                const isMe = p.id === myUid;
                const disconnected = p.connectionStatus === 'disconnected';
                return (
                  <motion.div
                    key={p.id}
                    className="flex items-center justify-between rounded-2xl px-4 py-3"
                    style={{
                      background: isMe ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      opacity: disconnected ? 0.5 : 1,
                    }}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: disconnected ? 0.5 : 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <div className="flex items-center gap-3">
                      {p.photoURL ? (
                        <img src={p.photoURL} alt="" className="h-9 w-9 rounded-xl object-cover" />
                      ) : (
                        <div
                          className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold text-white"
                          style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}
                        >
                          {p.displayName[0]?.toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-white">{p.displayName}</span>
                          {p.isHost && (
                            <span className="rounded bg-uno-yellow/20 px-1.5 py-0.5 text-[10px] font-bold text-uno-yellow">HOST</span>
                          )}
                          {isMe && (
                            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-uno-muted">You</span>
                          )}
                          {disconnected && (
                            <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-red-400">Away</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Kick button (host only, not self) */}
                      {isHost && !isMe && (
                        <button
                          onClick={() => handleKick(p.id)}
                          disabled={!!actionLoading}
                          className="rounded-lg px-2 py-1 text-[10px] font-semibold text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                        >
                          Kick
                        </button>
                      )}
                      {/* Ready indicator */}
                      <motion.div
                        className="flex h-7 w-7 items-center justify-center rounded-full text-sm"
                        style={{ background: p.isReady ? 'rgba(48,209,88,0.2)' : 'rgba(255,255,255,0.06)' }}
                        animate={{ scale: p.isReady ? [1, 1.2, 1] : 1 }}
                        transition={{ duration: 0.3 }}
                      >
                        {p.isReady ? '✓' : '·'}
                      </motion.div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Empty slots */}
          {room.players.length < settings.maxPlayers && (
            <div className="mt-2 rounded-2xl border border-dashed border-white/10 px-4 py-3 text-center">
              <span className="text-xs text-uno-muted">
                Waiting for players… ({settings.maxPlayers - room.players.length} spot{settings.maxPlayers - room.players.length !== 1 ? 's' : ''} left)
              </span>
            </div>
          )}
        </motion.div>

        {/* Host settings panel */}
        {isHost && (
          <motion.div
            className="glass w-full rounded-3xl"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          >
            <button
              className="flex w-full items-center justify-between px-5 py-4"
              onClick={() => setShowSettings(s => !s)}
            >
              <span className="font-semibold text-white text-sm">⚙️ Room Settings</span>
              <span className="text-uno-muted text-xs">{showSettings ? '▲' : '▼'}</span>
            </button>
            <AnimatePresence>
              {showSettings && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex flex-col gap-4 px-5 pb-5">
                    {/* Max players */}
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm text-white font-medium">Max Players</p>
                        <p className="text-xs text-uno-muted">{MIN_PLAYERS}–{MAX_PLAYERS}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSettingChange({ maxPlayers: Math.max(MIN_PLAYERS, settings.maxPlayers - 1) })}
                          disabled={settings.maxPlayers <= MIN_PLAYERS || !!actionLoading}
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white disabled:opacity-30"
                        >−</button>
                        <span className="w-6 text-center font-bold text-white">{settings.maxPlayers}</span>
                        <button
                          onClick={() => handleSettingChange({ maxPlayers: Math.min(MAX_PLAYERS, settings.maxPlayers + 1) })}
                          disabled={settings.maxPlayers >= MAX_PLAYERS || !!actionLoading}
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white disabled:opacity-30"
                        >+</button>
                      </div>
                    </div>

                    {/* Turn timer */}
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm text-white font-medium">Turn Timer</p>
                        <p className="text-xs text-uno-muted">0 = disabled</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSettingChange({ turnTimerSec: Math.max(MIN_TURN_TIMER_SEC, settings.turnTimerSec - 10) })}
                          disabled={settings.turnTimerSec <= MIN_TURN_TIMER_SEC || !!actionLoading}
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white disabled:opacity-30"
                        >−</button>
                        <span className="w-10 text-center font-bold text-white text-sm">
                          {settings.turnTimerSec === 0 ? 'Off' : `${settings.turnTimerSec}s`}
                        </span>
                        <button
                          onClick={() => handleSettingChange({ turnTimerSec: Math.min(MAX_TURN_TIMER_SEC, settings.turnTimerSec + 10) })}
                          disabled={settings.turnTimerSec >= MAX_TURN_TIMER_SEC || !!actionLoading}
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white disabled:opacity-30"
                        >+</button>
                      </div>
                    </div>

                    {/* Score limit */}
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm text-white font-medium">Score Limit</p>
                        <p className="text-xs text-uno-muted">0 = one round only</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSettingChange({ scoreLimit: Math.max(MIN_SCORE_LIMIT, settings.scoreLimit - 100) })}
                          disabled={settings.scoreLimit <= MIN_SCORE_LIMIT || !!actionLoading}
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white disabled:opacity-30"
                        >−</button>
                        <span className="w-12 text-center font-bold text-white text-sm">
                          {settings.scoreLimit === 0 ? '∞' : settings.scoreLimit}
                        </span>
                        <button
                          onClick={() => handleSettingChange({ scoreLimit: Math.min(MAX_SCORE_LIMIT, settings.scoreLimit + 100) })}
                          disabled={settings.scoreLimit >= MAX_SCORE_LIMIT || !!actionLoading}
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white disabled:opacity-30"
                        >+</button>
                      </div>
                    </div>

                    {/* Toggles */}
                    <div className="flex flex-col gap-2">
                      {[
                        { key: 'privateRoom', label: 'Private Room', desc: 'Block uninvited joins', value: settings.privateRoom },
                        { key: 'allowReconnect', label: 'Allow Reconnect', desc: '60s reconnect window', value: settings.allowReconnect },
                      ].map(({ key, label, desc, value }) => (
                        <div key={key} className="flex items-center justify-between rounded-xl bg-white/4 px-4 py-3">
                          <div>
                            <p className="text-sm text-white">{label}</p>
                            <p className="text-xs text-uno-muted">{desc}</p>
                          </div>
                          <button
                            onClick={() => handleSettingChange({ [key]: !value })}
                            disabled={!!actionLoading}
                            className="relative h-6 w-11 rounded-full transition-colors disabled:opacity-40"
                            style={{ background: value ? '#30d158' : 'rgba(255,255,255,0.15)' }}
                          >
                            <span
                              className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all"
                              style={{ left: value ? 22 : 2 }}
                            />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Animated preview cards */}
        <motion.div
          className="flex gap-3"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}
        >
          {([
            { color: 'red' as const, value: 'back' as const },
            { color: 'blue' as const, value: 'back' as const },
            { color: 'green' as const, value: 'back' as const },
          ] as const).map((c, i) => (
            <motion.div key={i} style={{ opacity: 0.45 }}
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 2 + i * 0.5, repeat: Infinity, ease: 'easeInOut', delay: i * 0.3 }}
            >
              <UnoCard color={c.color} value={c.value} size="sm" />
            </motion.div>
          ))}
        </motion.div>

        {/* Ready / Start */}
        <motion.div
          className="w-full flex flex-col gap-3"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        >
          {/* Ready status for non-host */}
          {!isHost && (
            <button
              onClick={handleReady}
              disabled={actionLoading === 'ready'}
              className="w-full h-13 rounded-2xl font-bold text-white text-base transition-all duration-200 active:scale-95 disabled:opacity-50"
              style={{
                background: isReady
                  ? 'linear-gradient(135deg,#1b5e20,#43a047)'
                  : 'linear-gradient(135deg,#0d47a1,#1e88e5)',
                boxShadow: isReady
                  ? '0 4px 20px rgba(67,160,71,0.4)'
                  : '0 4px 20px rgba(30,136,229,0.4)',
                height: 52,
              }}
            >
              {actionLoading === 'ready' ? '…' : isReady ? '✓ Ready!' : 'Mark as Ready'}
            </button>
          )}

          {/* Host: ready check + start */}
          {isHost && (
            <>
              <button
                onClick={handleReady}
                disabled={actionLoading === 'ready'}
                className="w-full rounded-2xl font-bold text-white text-sm transition-all duration-200 active:scale-95 disabled:opacity-50"
                style={{
                  background: isReady
                    ? 'linear-gradient(135deg,#1b5e20,#43a047)'
                    : 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  height: 44,
                }}
              >
                {isReady ? '✓ You are ready' : 'Mark yourself ready'}
              </button>
              <button
                onClick={handleStart}
                disabled={!allReady || !!actionLoading}
                className="w-full rounded-2xl font-bold text-white text-base transition-all duration-200 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: 'linear-gradient(135deg,#c91c31,#e63946)',
                  boxShadow: allReady ? '0 4px 24px rgba(230,57,70,0.45)' : 'none',
                  height: 52,
                }}
              >
                {actionLoading === 'start'
                  ? 'Starting…'
                  : allReady
                  ? '🎮 Start Game'
                  : `Waiting… (${readyCount}/${connectedPlayers.length} ready)`}
              </button>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}

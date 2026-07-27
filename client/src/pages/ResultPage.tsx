import { useEffect } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';

import { Button } from '@/components/ui/Button';
import { useGame } from '@/contexts/GameContext';
import { ROUTES } from '@/constants/routes';
import type { GameOverPayload } from '@online-uno/shared';

export default function ResultPage() {
  const { code } = useParams<{ code: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { gameOver: ctxGameOver } = useGame();

  // Accept game-over data from navigation state (primary) or context (fallback)
  const gameOver: GameOverPayload | null = (location.state as { gameOver?: GameOverPayload } | null)?.gameOver ?? ctxGameOver;

  // If no data at all, go home after a moment
  useEffect(() => {
    if (!gameOver) {
      const t = setTimeout(() => navigate(ROUTES.home), 2000);
      return () => clearTimeout(t);
    }
  }, [gameOver, navigate]);

  if (!gameOver) {
    return (
      <div className="animated-bg flex min-h-dvh items-center justify-center">
        <p className="text-uno-muted text-sm">Loading results…</p>
      </div>
    );
  }

  const sorted = [...gameOver.scores].sort((a, b) => b.score - a.score);
  const winner = sorted[0];

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
          <span className="font-semibold text-white">Game Over</span>
        </div>
        {code && (
          <span className="text-xs text-uno-muted font-mono">#{code}</span>
        )}
      </motion.header>

      <div className="flex flex-1 flex-col items-center justify-start gap-5 px-4 py-8 max-w-lg mx-auto w-full">

        {/* Winner banner */}
        <motion.div
          className="glass-strong w-full rounded-3xl p-6 text-center"
          initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}
        >
          <p className="text-5xl mb-3">🏆</p>
          <h1 className="text-2xl font-black text-white mb-1">{winner?.displayName ?? 'Winner'}</h1>
          <p className="text-sm text-uno-muted">
            {gameOver.reason === 'score-limit'
              ? `Reached ${winner?.score} points — match complete!`
              : 'Won the final round!'}
          </p>
        </motion.div>

        {/* Scoreboard */}
        <motion.div
          className="glass w-full rounded-3xl p-5"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        >
          <h2 className="font-semibold text-white mb-4">Final Scores</h2>
          <div className="flex flex-col gap-2">
            {sorted.map((s, i) => {
              const medal = ['🥇', '🥈', '🥉'][i] ?? `${i + 1}.`;
              return (
                <motion.div
                  key={s.playerId}
                  className="flex items-center justify-between rounded-2xl px-4 py-3"
                  style={{
                    background: i === 0 ? 'rgba(255,214,0,0.08)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${i === 0 ? 'rgba(255,214,0,0.2)' : 'rgba(255,255,255,0.06)'}`,
                  }}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.07 }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{medal}</span>
                    <span className="font-semibold text-white">{s.displayName}</span>
                  </div>
                  <span
                    className="text-sm font-bold"
                    style={{ color: i === 0 ? '#ffd60a' : 'rgba(255,255,255,0.7)' }}
                  >
                    {s.score} pts
                  </span>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Actions */}
        <motion.div
          className="w-full flex flex-col gap-3"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
        >
          <Link to={ROUTES.home}>
            <Button className="w-full" size="lg">
              🏠 Back to Home
            </Button>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

import { useAuth } from '@/contexts/AuthContext';
import { ROUTES } from '@/constants/routes';
import { UnoCard } from '@/components/ui/UnoCard';

const FLOATING_CARDS = [
  { color: 'red'    as const, value: '7' as const, x: '10%',  y: '15%',  rot: -20, delay: 0    },
  { color: 'blue'   as const, value: 'skip' as const, x: '80%', y: '10%', rot: 15,  delay: 0.4  },
  { color: 'green'  as const, value: 'reverse' as const, x: '5%', y: '70%', rot: -10, delay: 0.8 },
  { color: 'yellow' as const, value: 'draw-two' as const, x: '82%', y: '72%', rot: 22, delay: 0.6 },
  { color: 'wild'   as const, value: 'wild' as const, x: '50%', y: '5%', rot: 5, delay: 1.0 },
];

export default function SplashPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    const t = window.setTimeout(() => {
      navigate(user ? ROUTES.home : ROUTES.login, { replace: true });
    }, 2200);
    return () => clearTimeout(t);
  }, [loading, navigate, user]);

  return (
    <main className="animated-bg relative flex min-h-dvh flex-col items-center justify-center overflow-hidden">
      {/* Floating background cards */}
      {FLOATING_CARDS.map((c, i) => (
        <motion.div
          key={i}
          className="absolute opacity-30"
          style={{ left: c.x, top: c.y, '--float-rot': `${c.rot}deg` } as React.CSSProperties}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 0.3, scale: 1 }}
          transition={{ delay: c.delay, duration: 0.8 }}
        >
          <motion.div
            animate={{ y: [0, -16, 0], rotate: [c.rot, c.rot + 3, c.rot] }}
            transition={{ duration: 4 + i * 0.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <UnoCard color={c.color} value={c.value} size="lg" />
          </motion.div>
        </motion.div>
      ))}

      {/* Center logo */}
      <motion.div
        className="flex flex-col items-center gap-6 z-10"
        initial={{ opacity: 0, scale: 0.5, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.34, 1.56, 0.64, 1] }}
      >
        {/* UNO logo badge */}
        <motion.div
          className="flex h-28 w-28 items-center justify-center rounded-[28px]"
          style={{
            background: 'linear-gradient(145deg,#c91c31 0%,#e63946 45%,#ff6b7a 100%)',
            boxShadow: '0 0 60px rgba(230,57,70,0.6), 0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.2)',
          }}
          animate={{ boxShadow: [
            '0 0 40px rgba(230,57,70,0.5), 0 20px 60px rgba(0,0,0,0.5)',
            '0 0 80px rgba(230,57,70,0.8), 0 20px 60px rgba(0,0,0,0.5)',
            '0 0 40px rgba(230,57,70,0.5), 0 20px 60px rgba(0,0,0,0.5)',
          ]}}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <span className="text-4xl font-black tracking-tighter text-white" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
            UNO
          </span>
        </motion.div>

        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
        >
          <p className="text-2xl font-bold tracking-tight text-white">Online UNO</p>
          <p className="mt-1 text-sm text-uno-muted">Official rules · Real-time multiplayer</p>
        </motion.div>

        {/* Loading dots */}
        <motion.div
          className="flex gap-1.5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          {[0, 1, 2].map(i => (
            <motion.div
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-white/40"
              animate={{ scale: [1, 1.5, 1], opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
            />
          ))}
        </motion.div>
      </motion.div>
    </main>
  );
}

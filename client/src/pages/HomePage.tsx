import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

import { Button } from '@/components/ui/Button';
import { UnoCard } from '@/components/ui/UnoCard';
import { useAuth } from '@/contexts/AuthContext';
import { ROUTES } from '@/constants/routes';

const PREVIEW_CARDS = [
  { color: 'red'    as const, value: '7' as const,           rot: -12 },
  { color: 'blue'   as const, value: 'skip' as const,        rot: -4  },
  { color: 'green'  as const, value: 'reverse' as const,     rot: 4   },
  { color: 'yellow' as const, value: 'draw-two' as const,    rot: 12  },
  { color: 'wild'   as const, value: 'wild-draw-four' as const, rot: 20 },
];

export default function HomePage() {
  const { profile, signOut } = useAuth();
  const name = profile?.displayName ?? 'Player';
  const isGuest = profile?.isGuest ?? false;

  return (
    <main className="animated-bg flex min-h-dvh flex-col overflow-hidden">
      {/* Header */}
      <motion.header
        className="glass sticky top-0 z-20 flex items-center justify-between px-5 py-3"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{ background: 'linear-gradient(145deg,#c91c31,#e63946)', boxShadow: '0 4px 12px rgba(230,57,70,0.4)' }}>
            <span className="text-xs font-black text-white">UNO</span>
          </div>
          <span className="font-semibold text-white">Online UNO</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-uno-muted hidden sm:block">
            {name}{isGuest ? ' · Guest' : ''}
          </span>
          <Button variant="ghost" size="sm" onClick={() => signOut()}>Sign out</Button>
        </div>
      </motion.header>

      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-12">
        {/* Fan of preview cards */}
        <motion.div
          className="relative flex items-end justify-center"
          style={{ height: 120, width: 280 }}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          {PREVIEW_CARDS.map((c, i) => (
            <motion.div
              key={i}
              style={{
                position: 'absolute',
                transformOrigin: 'bottom center',
                rotate: c.rot,
                bottom: 0,
                left: '50%',
                marginLeft: -36,
                zIndex: i,
              }}
              initial={{ rotate: 0, y: 20, opacity: 0 }}
              animate={{ rotate: c.rot, y: 0, opacity: 1 }}
              transition={{ delay: 0.15 + i * 0.08, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
            >
              <UnoCard color={c.color} value={c.value} size="md" />
            </motion.div>
          ))}
        </motion.div>

        {/* Welcome */}
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <h1 className="text-3xl font-bold text-white">
            Welcome back, <span className="gradient-text">{name}</span>
          </h1>
          <p className="mt-2 text-sm text-uno-muted">Ready to play? Create a room or join a friend.</p>
        </motion.div>

        {/* Stats */}
        {profile && !isGuest && (
          <motion.div
            className="flex gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            {[
              { label: 'Played', value: profile.gamesPlayed },
              { label: 'Won',    value: profile.gamesWon },
              { label: 'Win %',  value: `${Math.round(profile.winPercentage)}%` },
            ].map(s => (
              <div key={s.label} className="glass rounded-2xl px-5 py-3 text-center">
                <div className="text-xl font-bold text-white">{s.value}</div>
                <div className="text-xs text-uno-muted">{s.label}</div>
              </div>
            ))}
          </motion.div>
        )}

        {/* Action buttons */}
        <motion.div
          className="w-full max-w-sm flex flex-col gap-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          <Link to={ROUTES.createRoom} className="block">
            <button
              className="w-full h-14 rounded-2xl text-base font-bold text-white transition-all duration-200 active:scale-95"
              style={{
                background: 'linear-gradient(135deg,#c91c31 0%,#e63946 50%,#ff6b7a 100%)',
                boxShadow: '0 4px 24px rgba(230,57,70,0.45), 0 1px 0 rgba(255,255,255,0.1) inset',
              }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 6px 32px rgba(230,57,70,0.65), 0 1px 0 rgba(255,255,255,0.1) inset')}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 4px 24px rgba(230,57,70,0.45), 0 1px 0 rgba(255,255,255,0.1) inset')}
            >
              🎮 Create Room
            </button>
          </Link>

          <Link to={ROUTES.joinRoom} className="block">
            <Button variant="secondary" size="lg" className="w-full text-base">
              🔑 Join Room
            </Button>
          </Link>

          <div className="grid grid-cols-2 gap-3 mt-2">
            <Link to={ROUTES.profile}>
              <Button variant="ghost" size="md" className="w-full">👤 Profile</Button>
            </Link>
            <Link to={ROUTES.settings}>
              <Button variant="ghost" size="md" className="w-full">⚙️ Settings</Button>
            </Link>
          </div>
        </motion.div>
      </div>
    </main>
  );
}

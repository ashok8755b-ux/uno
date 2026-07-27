import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

import { GuestNameModal } from '@/components/auth/GuestNameModal';
import { Button } from '@/components/ui/Button';
import { UnoCard } from '@/components/ui/UnoCard';
import { useAuth } from '@/contexts/AuthContext';
import { ROUTES } from '@/constants/routes';

const FLOAT_CARDS = [
  { color: 'red'    as const, value: '5' as const,        x: '8%',  y: '18%', rot: -18, delay: 0,   dur: 5   },
  { color: 'blue'   as const, value: 'skip' as const,     x: '78%', y: '12%', rot: 14,  delay: 0.5, dur: 6   },
  { color: 'yellow' as const, value: '3' as const,        x: '85%', y: '65%', rot: 22,  delay: 1.0, dur: 4.5 },
  { color: 'green'  as const, value: 'reverse' as const,  x: '5%',  y: '72%', rot: -8,  delay: 0.3, dur: 5.5 },
  { color: 'wild'   as const, value: 'wild-draw-four' as const, x: '55%', y: '5%', rot: 6, delay: 0.7, dur: 7 },
];

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/>
    </svg>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signInWithGoogle, signInAsGuest, authError, clearAuthError, isConfigured, loading, user } = useAuth();
  const [busy, setBusy] = useState<'google' | 'guest' | null>(null);
  const [guestModalOpen, setGuestModalOpen] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate(ROUTES.home, { replace: true });
  }, [loading, user, navigate]);

  const configMissing = Boolean((location.state as { configMissing?: boolean } | null)?.configMissing);

  const redirectAfterLogin = () => {
    const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname;
    navigate(from ?? ROUTES.home, { replace: true });
  };

  const onGoogle = async () => {
    clearAuthError();
    setBusy('google');
    try { await signInWithGoogle(); redirectAfterLogin(); }
    catch { /* stored in context */ }
    finally { setBusy(null); }
  };

  const onGuestSubmit = async (displayName: string) => {
    setBusy('guest');
    try { await signInAsGuest(displayName); setGuestModalOpen(false); redirectAfterLogin(); }
    catch { /* stored in context */ }
    finally { setBusy(null); }
  };

  if (loading) return null;

  return (
    <main className="animated-bg relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4">
      {/* Ambient orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle,#e63946 0%,transparent 70%)', filter: 'blur(60px)' }} />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle,#1d90f5 0%,transparent 70%)', filter: 'blur(60px)' }} />
        <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 h-64 w-64 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle,#2dc653 0%,transparent 70%)', filter: 'blur(80px)' }} />
      </div>

      {/* Floating background cards */}
      {FLOAT_CARDS.map((c, i) => (
        <motion.div
          key={i}
          className="pointer-events-none absolute opacity-20"
          style={{ left: c.x, top: c.y }}
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 0.2, scale: 1 }}
          transition={{ delay: c.delay, duration: 0.8 }}
        >
          <motion.div
            animate={{ y: [0, -14, 0], rotate: [c.rot, c.rot + 2, c.rot] }}
            transition={{ duration: c.dur, repeat: Infinity, ease: 'easeInOut' }}
          >
            <UnoCard color={c.color} value={c.value} size="md" />
          </motion.div>
        </motion.div>
      ))}

      {/* Login card */}
      <motion.div
        className="glass-strong relative z-10 w-full max-w-sm rounded-3xl p-8"
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
      >
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <motion.div
            className="flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{
              background: 'linear-gradient(145deg,#c91c31 0%,#e63946 100%)',
              boxShadow: '0 8px 32px rgba(230,57,70,0.5)',
            }}
            animate={{ boxShadow: [
              '0 8px 32px rgba(230,57,70,0.4)',
              '0 8px 48px rgba(230,57,70,0.7)',
              '0 8px 32px rgba(230,57,70,0.4)',
            ]}}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <span className="text-xl font-black tracking-tighter text-white">UNO</span>
          </motion.div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white">Play Online</h1>
            <p className="mt-1 text-sm text-uno-muted">Sign in to start a game</p>
          </div>
        </div>

        {/* Error / config warning */}
        <AnimatePresence>
          {(!isConfigured || configMissing) && (
            <motion.p
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="mb-4 rounded-xl border border-uno-yellow/30 bg-uno-yellow/10 px-4 py-3 text-xs text-uno-yellow"
            >
              Firebase not configured. Add your keys to <code className="text-white">client/.env</code>.
            </motion.p>
          )}
          {authError && (
            <motion.p
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400"
              role="alert"
            >
              {authError}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Auth buttons */}
        <div className="flex flex-col gap-3">
          <button
            disabled={!isConfigured || busy !== null}
            onClick={onGoogle}
            className="flex h-12 w-full items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-semibold text-white transition-all duration-200 hover:bg-white/10 hover:border-white/20 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
          >
            {busy === 'google' ? (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : <GoogleIcon />}
            {busy === 'google' ? 'Signing in…' : 'Continue with Google'}
          </button>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-white/8" />
            <span className="text-xs text-uno-muted">or</span>
            <div className="h-px flex-1 bg-white/8" />
          </div>

          <Button
            variant="secondary"
            size="md"
            className="w-full"
            disabled={!isConfigured || busy !== null}
            loading={busy === 'guest'}
            onClick={() => setGuestModalOpen(true)}
          >
            🎭 Play as Guest
          </Button>
        </div>

        <p className="mt-6 text-center text-xs text-uno-muted">
          No account needed · Guest names are temporary
        </p>
      </motion.div>

      <GuestNameModal
        open={guestModalOpen}
        busy={busy === 'guest'}
        onClose={() => !busy && setGuestModalOpen(false)}
        onSubmit={onGuestSubmit}
      />
    </main>
  );
}

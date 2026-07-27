import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/layout/PageHeader';
import { useRoom } from '@/contexts/RoomContext';
import { ROUTES, waitingRoomPath } from '@/constants/routes';

const CODE_LENGTH = 4;

export default function JoinRoomPage() {
  const { joinRoom } = useRoom();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const c = searchParams.get('code');
    if (c) setCode(c.replace(/\D/g, '').slice(0, CODE_LENGTH));
  }, [searchParams]);

  const handleJoin = async () => {
    const trimmed = code.trim();
    if (trimmed.length < CODE_LENGTH) {
      setError(`Please enter a ${CODE_LENGTH}-digit room code.`);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const room = await joinRoom(trimmed);
      navigate(waitingRoomPath(room.code));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not join room. Check the code and try again.');
      setLoading(false);
    }
  };

  const canJoin = code.trim().length === CODE_LENGTH && !loading;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 pb-12">
      <PageHeader
        title="Join room"
        subtitle={`Enter the ${CODE_LENGTH}-digit code from your friend.`}
      />
      {error && (
        <p className="mb-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-400 border border-red-500/20">
          {error}
        </p>
      )}
      <label className="flex flex-col gap-2 text-sm text-uno-muted">
        Room code
        <input
          type="text"
          inputMode="numeric"
          maxLength={CODE_LENGTH}
          placeholder="1234"
          value={code}
          onChange={e => {
            setError(null);
            setCode(e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH));
          }}
          onKeyDown={e => e.key === 'Enter' && canJoin && handleJoin()}
          autoFocus
          className="rounded-xl border border-uno-border bg-uno-surface px-4 py-3 text-2xl font-mono tracking-[0.4em] text-white placeholder:text-uno-muted/40 focus:border-white/40 focus:outline-none"
        />
      </label>
      <Button
        className="mt-4 w-full"
        onClick={handleJoin}
        disabled={!canJoin}
      >
        {loading ? 'Joining…' : '🔑 Join Room'}
      </Button>
      <Link
        to={ROUTES.home}
        className="mt-8 text-center text-sm text-uno-muted hover:text-white"
      >
        ← Back
      </Link>
    </main>
  );
}

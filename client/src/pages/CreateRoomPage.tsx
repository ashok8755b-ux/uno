import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/layout/PageHeader';
import { useRoom } from '@/contexts/RoomContext';
import { ROUTES, waitingRoomPath } from '@/constants/routes';

export default function CreateRoomPage() {
  const { createRoom } = useRoom();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setLoading(true);
    setError(null);
    try {
      const room = await createRoom();
      navigate(waitingRoomPath(room.code));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create room. Try again.');
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 pb-12">
      <PageHeader
        title="Create room"
        subtitle="Start a new game and invite friends with a room code."
      />
      {error && (
        <p className="mb-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-400 border border-red-500/20">
          {error}
        </p>
      )}
      <Button className="w-full" onClick={handleCreate} disabled={loading}>
        {loading ? 'Creating room…' : '🎮 Create Room'}
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

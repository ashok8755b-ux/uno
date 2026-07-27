import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import { App } from '@/App';
import { AuthProvider } from '@/contexts/AuthContext';
import { GameProvider } from '@/contexts/GameContext';
import { RoomProvider } from '@/contexts/RoomContext';
import '@/styles/index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <RoomProvider>
          <GameProvider>
            <App />
          </GameProvider>
        </RoomProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);

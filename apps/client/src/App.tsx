import React, { useEffect, useState } from 'react';
import { GameCanvas } from './game/GameCanvas';

export const App: React.FC = () => {
  const [serverHealth, setServerHealth] = useState<string>('Checking server...');

  useEffect(() => {
    fetch('http://localhost:2567/health')
      .then((res) => res.json())
      .then((data) => setServerHealth(`Connected to server: ${data.status} (${data.timestamp})`))
      .catch(() => setServerHealth('Server offline (run npm run dev:server)'));
  }, []);

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <header
        style={{
          position: 'absolute',
          top: 12,
          left: 16,
          zIndex: 100,
          background: 'rgba(18, 9, 36, 0.85)',
          padding: '8px 16px',
          borderRadius: '8px',
          border: '1px solid #db2777',
          fontSize: '14px',
          fontFamily: 'monospace',
        }}
      >
        <span style={{ color: '#ec4899', fontWeight: 'bold' }}>YEET ARENA</span> | {serverHealth}
      </header>
      <GameCanvas />
    </div>
  );
};


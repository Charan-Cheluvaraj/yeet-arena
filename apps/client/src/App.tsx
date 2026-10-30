import React, { useEffect, useState } from 'react';
import { GameCanvas } from './game/GameCanvas';

export const App: React.FC = () => {
  const [serverStatus, setServerStatus] = useState<string>('Offline (Single Player)');

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    fetch('http://localhost:2567/health', { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error('Offline');
        return res.json();
      })
      .then((data) => {
        if (isMounted) {
          setServerStatus(`Connected (${data.status})`);
        }
      })
      .catch(() => {
        if (isMounted) {
          setServerStatus('Offline (Single Player Ready)');
        }
      });

    return () => {
      isMounted = false;
      controller.abort();
    };
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
          padding: '6px 14px',
          borderRadius: '8px',
          border: '1px solid #db2777',
          fontSize: '13px',
          fontFamily: 'monospace',
          pointerEvents: 'none',
        }}
      >
        <span style={{ color: '#ec4899', fontWeight: 'bold' }}>YEET ARENA</span> |{' '}
        <span style={{ color: serverStatus.includes('Connected') ? '#4ade80' : '#cbd5e1' }}>
          Server: {serverStatus}
        </span>
      </header>
      <GameCanvas />
    </div>
  );
};

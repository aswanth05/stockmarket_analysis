import { useEffect, useState } from 'react';
import type { HealthResponse } from '@ust/shared';
import { apiGet } from './api/client';
import { Gallery } from './gallery/Gallery';

type ServerState = { kind: 'checking' } | { kind: 'ok'; time: string } | { kind: 'down' };

export function App() {
  const [server, setServer] = useState<ServerState>({ kind: 'checking' });

  useEffect(() => {
    const ctrl = new AbortController();
    apiGet<HealthResponse>('/health', ctrl.signal)
      .then((h) => setServer({ kind: 'ok', time: h.serverTime }))
      .catch((e: unknown) => {
        if (!(e instanceof DOMException && e.name === 'AbortError')) setServer({ kind: 'down' });
      });
    return () => ctrl.abort();
  }, []);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 'var(--space-6) var(--space-4)' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 'var(--text-xl)', color: 'var(--color-accent)' }}>US Stock Terminal</h1>
          <p className="muted" style={{ margin: 0 }}>Step 27 scaffold · component examples</p>
        </div>
        <span
          className="pill"
          role="status"
          style={{ color: server.kind === 'ok' ? 'var(--color-gain)' : server.kind === 'down' ? 'var(--color-loss)' : 'var(--color-text-muted)' }}
        >
          <span className="pill-dot" aria-hidden="true" />
          {server.kind === 'ok' ? 'API server connected' : server.kind === 'down' ? 'API server not reachable' : 'Checking API server…'}
        </span>
      </header>
      <main>
        <Gallery />
      </main>
    </div>
  );
}

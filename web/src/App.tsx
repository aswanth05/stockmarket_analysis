import { useEffect, useState } from 'react';
import type { HealthResponse } from '@ust/shared';
import { apiGet } from './api/client';
import { Gallery } from './gallery/Gallery';
import { AppShell, NAV, type ScreenId } from './layout/AppShell';
import { ComingSoon } from './screens/ComingSoon';
import { HomeScreen } from './screens/home/HomeScreen';

type ServerState = 'checking' | 'ok' | 'down' | 'static';

/** True for the GitHub Pages build, which has no API server behind it. */
const STATIC_PREVIEW = import.meta.env.VITE_STATIC_PREVIEW === 'true';

const SCREENS = new Set<string>([...NAV.map((n) => n.id), 'components']);
const screenFromHash = (): ScreenId => {
  const id = window.location.hash.replace(/^#\/?/, '');
  return (SCREENS.has(id) ? id : 'home') as ScreenId;
};

function useServerState(): ServerState {
  const [state, setState] = useState<ServerState>(STATIC_PREVIEW ? 'static' : 'checking');
  useEffect(() => {
    if (STATIC_PREVIEW) return;
    const ctrl = new AbortController();
    apiGet<HealthResponse>('/health', ctrl.signal)
      .then(() => setState('ok'))
      .catch((e: unknown) => {
        if (!(e instanceof DOMException && e.name === 'AbortError')) setState('down');
      });
    return () => ctrl.abort();
  }, []);
  return state;
}

const SERVER_TITLES: Record<ServerState, string> = {
  checking: 'Checking API server',
  ok: 'API server connected',
  down: 'API server not reachable',
  static: 'Static preview: no API server',
};

export function App() {
  const [screen, setScreen] = useState<ScreenId>(screenFromHash);
  const server = useServerState();

  useEffect(() => {
    const onHash = () => setScreen(screenFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = (s: ScreenId) => {
    window.location.hash = s === 'home' ? '' : `/${s}`;
    setScreen(s);
  };

  const item = NAV.find((n) => n.id === screen);
  // Until real data is connected, the top bar says plainly that numbers are samples.
  const dataBadge = (
    <span className="pill" style={{ color: 'var(--color-warn)' }} title={SERVER_TITLES[server]}>
      <span className="pill-dot" aria-hidden="true" />
      Sample data
    </span>
  );

  return (
    <AppShell screen={screen} onNavigate={navigate} dataBadge={dataBadge}>
      {screen === 'home' && <HomeScreen />}
      {screen === 'components' && <Gallery />}
      {screen !== 'home' && screen !== 'components' && <ComingSoon label={item?.label ?? 'This screen'} step={item?.step} />}
      <p className="server-note muted">{SERVER_TITLES[server]}</p>
    </AppShell>
  );
}

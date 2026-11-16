import { useEffect, useState } from 'react';
import type { MarketStatusResponse, QuoteView } from '@ust/shared';
import { useApi } from './api/useApi';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { FreshnessBadge } from './components/FreshnessBadge';
import { EmptyState, LoadingSkeleton } from './components/states/States';
import { Gallery } from './gallery/Gallery';
import { AppShell, NAV, type ScreenId } from './layout/AppShell';
import { MarketContext } from './layout/MarketContext';
import { LoginScreen } from './screens/LoginScreen';
import { MethodologyScreen } from './screens/MethodologyScreen';
import { ScreenerScreen } from './screens/ScreenerScreen';
import { SectorsScreen } from './screens/SectorsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { WatchlistScreen } from './screens/WatchlistScreen';
import { HomeScreen } from './screens/home/HomeScreen';
import { SampleHomeScreen } from './screens/home/SampleHomeScreen';
import { ResearchScreen } from './screens/research/ResearchScreen';

/** True for the GitHub Pages build, which has no server: it shows the sample layout only. */
const STATIC_PREVIEW = import.meta.env.VITE_STATIC_PREVIEW === 'true';

const SCREENS = new Set<string>([...NAV.map((n) => n.id), 'components']);

interface Route {
  screen: ScreenId;
  param?: string;
}

function parseHash(): Route {
  const [id, param] = window.location.hash.replace(/^#\/?/, '').split('/');
  return SCREENS.has(id ?? '') ? { screen: id as ScreenId, param: param ? decodeURIComponent(param) : undefined } : { screen: 'home' };
}

function useRoute() {
  const [route, setRoute] = useState<Route>(parseHash);
  useEffect(() => {
    const on = () => setRoute(parseHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function App() {
  if (STATIC_PREVIEW) return <StaticPreview />;
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}

/** The terminal is hidden until login (step 28). */
function Gate() {
  const { user, checking } = useAuth();
  if (checking) return <div className="auth-page"><LoadingSkeleton lines={3} label="Checking your session" /></div>;
  if (!user) return <LoginScreen />;
  return <Terminal email={user.email} />;
}

function Terminal({ email }: { email: string }) {
  const { logout } = useAuth();
  const route = useRoute();
  const market = useApi<MarketStatusResponse>('/market/status', 60_000);
  // Top-bar freshness badge follows the S&P 500 proxy quote and updates with polling.
  const spy = useApi<{ quotes: QuoteView[] }>('/quotes?tickers=SPY', 30_000);
  const q = spy.data?.quotes[0];

  const badge =
    q?.freshness && q.asOf ? (
      <FreshnessBadge freshness={q.freshness} asOf={q.asOf} delayMinutes={q.delayMinutes} />
    ) : (
      <span className="pill muted" title="No market data stored yet">No market data</span>
    );

  return (
    <MarketContext.Provider value={market.data}>
      <AppShell
        screen={route.screen}
        status={market.data?.status ?? null}
        statusNote={market.data?.holiday ? `Holiday: ${market.data.holiday}` : market.data?.earlyClose ? `Early close ${market.data.earlyClose} ET` : undefined}
        dataBadge={badge}
        account={{ email, onLogout: () => void logout() }}
        showComponents={import.meta.env.DEV}
      >
        {route.screen === 'home' && <HomeScreen />}
        {route.screen === 'research' && <ResearchScreen ticker={route.param} />}
        {route.screen === 'screener' && <ScreenerScreen />}
        {route.screen === 'sectors' && <SectorsScreen />}
        {route.screen === 'watchlist' && <WatchlistScreen />}
        {route.screen === 'methodology' && <MethodologyScreen />}
        {route.screen === 'settings' && <SettingsScreen />}
        {route.screen === 'components' && <Gallery />}
      </AppShell>
    </MarketContext.Provider>
  );
}

function StaticPreview() {
  const route = useRoute();
  return (
    <AppShell
      screen={route.screen}
      status={null}
      statusNote="Static preview"
      dataBadge={<span className="pill" style={{ color: 'var(--color-warn)' }}>Sample data</span>}
      showComponents
    >
      {route.screen === 'home' && <SampleHomeScreen />}
      {route.screen === 'components' && <Gallery />}
      {route.screen !== 'home' && route.screen !== 'components' && (
        <EmptyState title="This screen needs the app’s server">
          The public preview shows the layout with sample data only. Run the app locally (see README) to log in and use live data.
        </EmptyState>
      )}
    </AppShell>
  );
}

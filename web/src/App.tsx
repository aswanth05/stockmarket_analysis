import { useEffect, useState } from 'react';
import type { MarketStatusResponse, QuoteView } from '@ust/shared';
import { useApi } from './api/useApi';
import { AuthProvider, useAuth, useOptionalAuth } from './auth/AuthContext';
import { FreshnessBadge } from './components/FreshnessBadge';
import { LoadingSkeleton } from './components/states/States';
import { DemoBanner } from './demo/DemoBanner';
import { DemoHome } from './demo/DemoHome';
import { DEMO } from './demo/mode';
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
import { ResearchScreen } from './screens/research/ResearchScreen';


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
  // Demo build: no login; every request is answered in the browser with sample data.
  if (DEMO) return <Terminal email="demo@example.com" />;
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
  const route = useRoute();
  const onLogout = useLogout();
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
        account={DEMO ? undefined : { email, onLogout }}
        showComponents={import.meta.env.DEV}
      >
        {DEMO && <DemoBanner />}
        {route.screen === 'home' && (DEMO ? <DemoHome /> : <HomeScreen />)}
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

/** Logout needs the auth context, which the demo build does not mount. */
function useLogout() {
  const auth = useOptionalAuth();
  return () => void auth?.logout();
}

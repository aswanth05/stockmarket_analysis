import { useEffect, useState, type ReactNode } from 'react';
import { easternClock, marketStatusAt } from '@ust/shared';
import { MarketStatusPill } from '../components/MarketStatusPill';

export type ScreenId = 'home' | 'research' | 'screener' | 'sectors' | 'watchlist' | 'methodology' | 'settings' | 'components';

interface NavItem {
  id: ScreenId;
  label: string;
  icon: string;
  /** Plan step that builds this screen; undefined when it exists now. */
  step?: number;
  phone?: boolean;
}

export const NAV: NavItem[] = [
  { id: 'home', label: 'Home', icon: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z', phone: true },
  { id: 'research', label: 'Stock Research', icon: 'M4 19V5m0 14h16M8 15l3-4 3 2 5-6', step: 35, phone: true },
  { id: 'screener', label: 'Stock Screener', icon: 'M4 5h16l-6 7v6l-4 2v-8z', step: 39, phone: true },
  { id: 'sectors', label: 'Sector Analysis', icon: 'M12 3v9h9A9 9 0 1 1 12 3zm3 0a6 6 0 0 1 6 6h-6z', step: 38, phone: true },
  { id: 'watchlist', label: 'My Watchlist', icon: 'M12 4l2.4 5 5.6.6-4.2 3.8 1.2 5.6-5-2.9-5 2.9 1.2-5.6L4 9.6 9.6 9z', step: 34, phone: true },
  { id: 'methodology', label: 'Methodology and Sources', icon: 'M5 4h11l3 3v13H5zM9 10h6M9 14h6', step: 35 },
  { id: 'settings', label: 'Settings', icon: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM4 12h2m12 0h2M12 4v2m0 12v2', step: 28 },
];

function Icon({ d }: { d: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

interface Props {
  screen: ScreenId;
  onNavigate: (s: ScreenId) => void;
  dataBadge: ReactNode;
  children: ReactNode;
}

export function AppShell({ screen, onNavigate, dataBadge, children }: Props) {
  const now = useNow();
  const clock = easternClock(now);
  const item = NAV.find((n) => n.id === screen);

  const navButton = (n: NavItem, variant: 'side' | 'bottom') => (
    <button
      key={n.id}
      type="button"
      className={`nav-item nav-${variant}`}
      aria-current={screen === n.id ? 'page' : undefined}
      onClick={() => onNavigate(n.id)}
      title={n.label}
    >
      <Icon d={n.icon} />
      <span className="nav-label">{variant === 'bottom' ? n.label.replace('Stock ', '').replace('My ', '').replace(' Analysis', 's') : n.label}</span>
    </button>
  );

  return (
    <div className="shell">
      <aside className="sidebar" aria-label="Main navigation">
        <div className="logo">
          <span className="logo-mark" aria-hidden="true">◆</span>
          <span className="nav-label">US Stock Terminal</span>
        </div>
        <nav>{NAV.map((n) => navButton(n, 'side'))}</nav>
        <div className="sidebar-foot">
          <button type="button" className="nav-item nav-side" aria-current={screen === 'components' ? 'page' : undefined} onClick={() => onNavigate('components')} title="Component examples">
            <Icon d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />
            <span className="nav-label">Component examples</span>
          </button>
        </div>
      </aside>

      <div className="main-col">
        <header className="topbar">
          <h1 className="page-title">{screen === 'components' ? 'Component examples' : item?.label}</h1>
          <div className="topbar-right">
            <MarketStatusPill status={marketStatusAt(now)} etTime={clock.label} />
            {dataBadge}
            <button type="button" className="icon-btn" aria-label="Notifications (none)">
              <Icon d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4zM10 20h4" />
            </button>
            <button type="button" className="icon-btn account" aria-label="Account menu (login arrives in step 28)">
              <span aria-hidden="true">G</span>
            </button>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>

      <nav className="bottom-nav" aria-label="Main navigation">
        {NAV.filter((n) => n.phone).map((n) => navButton(n, 'bottom'))}
      </nav>
    </div>
  );
}

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { easternClock, type MarketStatus } from '@ust/shared';
import { MarketStatusPill } from '../components/MarketStatusPill';

export type ScreenId = 'home' | 'research' | 'screener' | 'sectors' | 'watchlist' | 'methodology' | 'settings' | 'components';

interface NavItem {
  id: ScreenId;
  label: string;
  short: string;
  icon: string;
  phone?: boolean;
}

export const NAV: NavItem[] = [
  { id: 'home', label: 'Home', short: 'Home', icon: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z', phone: true },
  { id: 'research', label: 'Stock Research', short: 'Research', icon: 'M4 19V5m0 14h16M8 15l3-4 3 2 5-6', phone: true },
  { id: 'screener', label: 'Stock Screener', short: 'Screener', icon: 'M4 5h16l-6 7v6l-4 2v-8z', phone: true },
  { id: 'sectors', label: 'Sector Analysis', short: 'Sectors', icon: 'M12 3v9h9A9 9 0 1 1 12 3zm3 0a6 6 0 0 1 6 6h-6z', phone: true },
  { id: 'watchlist', label: 'My Watchlist', short: 'Watchlist', icon: 'M12 4l2.4 5 5.6.6-4.2 3.8 1.2 5.6-5-2.9-5 2.9 1.2-5.6L4 9.6 9.6 9z', phone: true },
  { id: 'methodology', label: 'Methodology and Sources', short: 'Sources', icon: 'M5 4h11l3 3v13H5zM9 10h6M9 14h6' },
  { id: 'settings', label: 'Settings', short: 'Settings', icon: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM4 12h2m12 0h2M12 4v2m0 12v2' },
];

export const hrefFor = (s: ScreenId, param?: string) => (s === 'home' ? '#/' : `#/${s}${param ? `/${encodeURIComponent(param)}` : ''}`);

function Icon({ d }: { d: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

function useNow(intervalMs = 15_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

interface Props {
  screen: ScreenId;
  /** Server status; null while loading or in the static preview. */
  status: MarketStatus | null;
  statusNote?: string;
  dataBadge: ReactNode;
  account?: { email: string; onLogout: () => void };
  showComponents?: boolean;
  children: ReactNode;
}

export function AppShell({ screen, status, statusNote, dataBadge, account, showComponents, children }: Props) {
  const now = useNow();
  const clock = easternClock(now);
  const item = NAV.find((n) => n.id === screen);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [menuOpen]);

  // Move focus to the page heading on navigation, for keyboard and screen-reader users.
  useEffect(() => {
    mainRef.current?.focus({ preventScroll: true });
  }, [screen]);

  const link = (n: NavItem, variant: 'side' | 'bottom') => (
    <a key={n.id} href={hrefFor(n.id)} className={`nav-item nav-${variant}`} aria-current={screen === n.id ? 'page' : undefined} title={n.label}>
      <Icon d={n.icon} />
      <span className="nav-label">{variant === 'bottom' ? n.short : n.label}</span>
    </a>
  );

  return (
    <div className="shell">
      <a className="skip-link" href="#main" onClick={(e) => { e.preventDefault(); mainRef.current?.focus(); }}>
        Skip to content
      </a>
      <aside className="sidebar" aria-label="Main navigation">
        <div className="logo">
          <span className="logo-mark" aria-hidden="true">◆</span>
          <span className="nav-label">US Stock Terminal</span>
        </div>
        <nav>{NAV.map((n) => link(n, 'side'))}</nav>
        {showComponents && (
          <div className="sidebar-foot">
            <a href="#/components" className="nav-item nav-side" aria-current={screen === 'components' ? 'page' : undefined} title="Component examples">
              <Icon d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />
              <span className="nav-label">Component examples</span>
            </a>
          </div>
        )}
      </aside>

      <div className="main-col">
        <header className="topbar">
          <h1 className="page-title">{screen === 'components' ? 'Component examples' : item?.label}</h1>
          <div className="topbar-right">
            {status ? (
              <MarketStatusPill status={status} etTime={clock.label} />
            ) : (
              <span className="pill muted">{clock.label} ET</span>
            )}
            {statusNote && <span className="pill muted">{statusNote}</span>}
            {dataBadge}
            {account && (
              <div className="menu" ref={menuRef}>
                <button type="button" className="icon-btn account" aria-haspopup="menu" aria-expanded={menuOpen} aria-label={`Account menu for ${account.email}`} onClick={() => setMenuOpen((o) => !o)}>
                  <span aria-hidden="true">{account.email[0]?.toUpperCase()}</span>
                </button>
                {menuOpen && (
                  <div className="menu-pop" role="menu">
                    <div className="menu-head muted">{account.email}</div>
                    <a role="menuitem" href="#/settings" onClick={() => setMenuOpen(false)}>Settings</a>
                    <a role="menuitem" href="#/methodology" onClick={() => setMenuOpen(false)}>Methodology and Sources</a>
                    <button role="menuitem" type="button" onClick={account.onLogout}>Log out</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>
        <main className="content" id="main" ref={mainRef} tabIndex={-1} aria-label={item?.label ?? 'Content'}>
          {children}
        </main>
      </div>

      <nav className="bottom-nav" aria-label="Main navigation (phone)">
        {NAV.filter((n) => n.phone).map((n) => link(n, 'bottom'))}
      </nav>
    </div>
  );
}

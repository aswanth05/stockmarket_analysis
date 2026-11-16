import type { ProvidersStatus } from '@ust/shared';
import { DEMO } from '../demo/mode';

const NEEDS: Record<keyof ProvidersStatus, { what: string; lines: string }> = {
  alpaca: { what: 'Market prices', lines: 'ALPACA_API_KEY_ID and ALPACA_API_SECRET_KEY' },
  eodhd: { what: 'Delayed fallback prices', lines: 'EODHD_API_TOKEN' },
  edgar: { what: 'Company filings and financials', lines: 'SEC_EDGAR_USER_AGENT (your name and email)' },
  anthropic: { what: 'AI reviews', lines: 'ANTHROPIC_API_KEY and ANTHROPIC_MONTHLY_BUDGET_USD' },
};

/** Explains which data source is missing and exactly what to add to server/.env. Shown instead of guessed values. */
export function ProviderNotice({ providers, need }: { providers: ProvidersStatus; need: (keyof ProvidersStatus)[] }) {
  const missing = need.filter((k) => !providers[k]);
  // The demo build has no server; its banner already explains that all data is sample.
  if (DEMO || !missing.length) return null;
  return (
    <div className="notice" role="note">
      <strong>Not connected yet:</strong>{' '}
      {missing.map((k, i) => (
        <span key={k}>
          {i > 0 && '; '}
          {NEEDS[k].what} need <code>{NEEDS[k].lines}</code>
        </span>
      ))}{' '}
      in <code>server/.env</code>. Restart the server after adding them. Until then these areas stay empty rather than showing guessed numbers.
    </div>
  );
}

import { useEffect, useState } from 'react';
import { formatDate } from '../format';
import { loadSummary, type Summary } from './demoApi';

/** Says exactly what the public demo contains: real SEC data with its date, and no prices. */
export function DemoBanner() {
  const [s, setS] = useState<Summary | null>(null);
  useEffect(() => {
    void loadSummary().then(setS);
  }, []);
  return (
    <div className="notice demo-banner" role="note">
      <strong>Public demo.</strong>{' '}
      {s?.status === 'ok' ? (
        <>Company financials and filings are real SEC EDGAR data (snapshot of {formatDate(s.generatedAt?.slice(0, 10))}, not live). </>
      ) : (
        <>The SEC data snapshot is not available yet, so financial figures are empty. </>
      )}
      Stock prices are not included, and login and AI reviews are off. Your watchlist is kept in this browser only.
    </div>
  );
}

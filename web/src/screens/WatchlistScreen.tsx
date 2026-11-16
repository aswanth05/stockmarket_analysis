import { useState } from 'react';
import type { WatchlistItem } from '@ust/shared';
import { apiDelete, apiPost } from '../api/client';
import { useApi } from '../api/useApi';
import { ChangeValue } from '../components/ChangeValue';
import { FreshnessBadge } from '../components/FreshnessBadge';
import { ServerTickerSearch } from '../components/ServerTickerSearch';
import { EmptyState, ErrorState, LoadingSkeleton } from '../components/states/States';
import { formatEt, formatPrice } from '../format';

export function WatchlistScreen() {
  // Polls every 30 seconds: prices and freshness badges update without a reload (step 41).
  const { data, error, loading, reload, setData } = useApi<{ items: WatchlistItem[] }>('/watchlist', 30_000);
  const [filter, setFilter] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const add = async (ticker: string) => {
    setMsg(null);
    try {
      setData(await apiPost<{ items: WatchlistItem[] }>('/watchlist', { ticker }));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  };
  const remove = async (ticker: string) => {
    setMsg(null);
    try {
      setData(await apiDelete<{ items: WatchlistItem[] }>(`/watchlist/${encodeURIComponent(ticker)}`));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  };

  if (loading && !data) return <LoadingSkeleton lines={6} label="Loading watchlist" />;
  if (!data) return <ErrorState what="Your watchlist could not be loaded." next={error ?? ''} onRetry={reload} />;

  const f = filter.trim().toLowerCase();
  const shown = f ? data.items.filter((i) => i.ticker.toLowerCase().includes(f) || i.name.toLowerCase().includes(f)) : data.items;

  return (
    <div className="stack">
      <section className="card watch-tools">
        <div>
          <h2 className="card-title">Add a company</h2>
          <ServerTickerSearch onSelect={(o) => add(o.ticker)} label="Search to add a company" />
        </div>
        <label className="field">
          <span className="card-title">Search your list</span>
          <input type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Ticker or name" />
        </label>
        {msg && <p className="form-error" role="alert">{msg}</p>}
      </section>

      <section className="card" aria-label="Saved companies">
        {error && <p className="form-error" role="alert">Latest refresh failed: {error}. Showing the last loaded prices.</p>}
        {data.items.length === 0 ? (
          <EmptyState title="Your watchlist is empty">Search above to add a company. Your list is saved to your account.</EmptyState>
        ) : shown.length === 0 ? (
          <EmptyState title="No saved companies match your search" />
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <caption className="visually-hidden">Watchlist</caption>
              <thead>
                <tr>
                  <th scope="col">Ticker</th>
                  <th scope="col">Company</th>
                  <th scope="col" className="num">Last</th>
                  <th scope="col" className="num">Change</th>
                  <th scope="col">Data time</th>
                  <th scope="col">Research</th>
                  <th scope="col"><span className="visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {shown.map((i) => (
                  <tr key={i.ticker}>
                    <td><a className="num ticker" href={`#/research/${i.ticker}`}>{i.ticker}</a></td>
                    <td>{i.name}<div className="data-time">{i.sector ?? ''}</div></td>
                    <td className="num">{formatPrice(i.quote.price)}</td>
                    <td className="num"><ChangeValue pct={i.quote.changePct} /></td>
                    <td>
                      {i.quote.asOf && i.quote.freshness ? (
                        <>
                          <FreshnessBadge freshness={i.quote.freshness} asOf={i.quote.asOf} delayMinutes={i.quote.delayMinutes} />
                          <div className="data-time">{formatEt(i.quote.asOf)}</div>
                        </>
                      ) : (
                        <span className="muted">No price stored</span>
                      )}
                    </td>
                    <td className="muted">{i.researchStatus}</td>
                    <td>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => remove(i.ticker)} aria-label={`Remove ${i.ticker} from watchlist`}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="data-time">{data.items.length} saved · prices refresh every 30 seconds while this page is open</p>
      </section>
    </div>
  );
}

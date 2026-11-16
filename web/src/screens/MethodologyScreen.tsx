import type { MethodologyResponse } from '@ust/shared';
import { useApi } from '../api/useApi';
import { ErrorState, LoadingSkeleton } from '../components/states/States';
import { formatDate, formatEt } from '../format';

export function SourcesTable({ sources }: { sources: MethodologyResponse['sources'] }) {
  return (
    <div className="table-scroll">
      <table className="data-table">
        <caption className="visually-hidden">Data sources</caption>
        <thead>
          <tr>
            <th scope="col">Source</th>
            <th scope="col">Used for</th>
            <th scope="col">Timeliness</th>
            <th scope="col">Status</th>
            <th scope="col">Last successful update</th>
          </tr>
        </thead>
        <tbody>
          {sources.map((s) => (
            <tr key={s.id}>
              <th scope="row">{s.name}</th>
              <td>{s.use}</td>
              <td className="muted">{s.freshness}</td>
              <td>
                {s.configured ? <span className="gain">Connected</span> : <span className="muted">Not connected</span>}
                {s.lastError && <div className="data-time loss">Last error: {s.lastError}</div>}
              </td>
              <td className="num">{s.lastSuccess ? formatEt(s.lastSuccess) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MethodologyScreen() {
  const { data, error, loading, reload } = useApi<MethodologyResponse>('/methodology', 60_000);
  if (loading && !data) return <LoadingSkeleton lines={8} label="Loading methodology" />;
  if (!data) return <ErrorState what="Methodology could not be loaded." next={error ?? ''} onRetry={reload} />;

  return (
    <div className="stack">
      <section className="card">
        <h2 className="section-title">Formulas</h2>
        <p className="muted">Every figure is calculated on the server from stored data. AI never calculates numbers.</p>
        <dl className="formula-list">
          {data.metrics.map((m) => (
            <div key={m.id}>
              <dt>
                {m.name} <span className="pill muted">{m.version}</span>
              </dt>
              <dd>
                <code>{m.formula}</code>
                <div className="muted">Inputs: {m.inputs.join('; ')}</div>
                <div className="muted">{m.notes}</div>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="card">
        <h2 className="section-title">Factor score (experimental)</h2>
        <ul className="risk-list">
          {data.factors.map((f) => (
            <li key={f.id}>
              <strong>{f.name}</strong>, weight {Math.round(f.weight * 100)}%: {f.basis}
            </li>
          ))}
        </ul>
        <p className="data-time">The score has not been tested against outcomes. It describes the figures; it does not predict prices.</p>
      </section>

      <section className="card">
        <h2 className="section-title">Data sources</h2>
        <SourcesTable sources={data.sources} />
      </section>

      <section className="card">
        <h2 className="section-title">Universe and calendar</h2>
        <ul className="risk-list">
          <li>
            {data.universe.name}: {data.universe.size} companies, from {data.universe.source}, saved {formatDate(data.universe.retrievedAt)}.
          </li>
          <li>Market hours and holidays: {data.calendar.source}, saved {formatDate(data.calendar.retrievedAt)}. All times are US Eastern.</li>
          <li>Index levels are shown through ETF proxies (SPY, DIA, QQQ), not the official index values.</li>
        </ul>
      </section>
    </div>
  );
}

import type { SectorsResponse } from '@ust/shared';
import { useApi } from '../api/useApi';
import { ChangeValue } from '../components/ChangeValue';
import { ErrorState, LoadingSkeleton } from '../components/states/States';
import { formatEt, MISSING } from '../format';

const pctCell = (v: number | null) => (v == null ? <span className="muted">{MISSING}</span> : `${v.toFixed(1)}%`);

/** Two clearly separate areas (UI_DESIGN §4): recent price movement, then business outlook from filings. */
export function SectorsScreen() {
  const { data, error, loading, reload } = useApi<SectorsResponse>('/sectors', 60_000);
  if (loading && !data) return <LoadingSkeleton lines={8} label="Loading sectors" />;
  if (!data) return <ErrorState what="Sector data could not be loaded." next={error ?? ''} onRetry={reload} />;

  return (
    <div className="stack">
      <section className="card area" aria-labelledby="movement-h">
        <p className="area-kicker">Area 1 · Market prices</p>
        <h2 id="movement-h" className="section-title">Recent price movement</h2>
        <p className="muted">How each sector’s stocks have moved. Equal-weighted average of members of the saved S&P 500 list.</p>
        <div className="table-scroll">
          <table className="data-table">
            <caption className="visually-hidden">Sector price movement</caption>
            <thead>
              <tr>
                <th scope="col">Sector</th>
                <th scope="col" className="num">Today</th>
                <th scope="col" className="num">1 week</th>
                <th scope="col" className="num">1 month</th>
                <th scope="col" className="num">Companies with prices</th>
              </tr>
            </thead>
            <tbody>
              {data.movement.map((m) => (
                <tr key={m.sector}>
                  <th scope="row">{m.sector}</th>
                  <td className="num"><ChangeValue pct={m.change1d} /></td>
                  <td className="num"><ChangeValue pct={m.change1w} /></td>
                  <td className="num"><ChangeValue pct={m.change1m} /></td>
                  <td className="num">{m.withData} of {m.companies}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="data-time">{data.movementAsOf ? `Latest quote ${formatEt(data.movementAsOf)} · week and month use stored daily closes` : 'No prices stored yet'}</p>
      </section>

      <section className="card area area-outlook" aria-labelledby="outlook-h">
        <p className="area-kicker">Area 2 · Company filings</p>
        <h2 id="outlook-h" className="section-title">Business outlook</h2>
        <p className="muted">How the businesses themselves are doing, from annual figures filed with the SEC. Separate from price movement.</p>
        <div className="table-scroll">
          <table className="data-table">
            <caption className="visually-hidden">Sector business figures</caption>
            <thead>
              <tr>
                <th scope="col">Sector</th>
                <th scope="col" className="num">Median revenue growth</th>
                <th scope="col" className="num">Median net margin</th>
                <th scope="col" className="num">Companies with data</th>
                <th scope="col">Period</th>
              </tr>
            </thead>
            <tbody>
              {data.outlook.map((o) => (
                <tr key={o.sector}>
                  <th scope="row">{o.sector}</th>
                  <td className="num">{pctCell(o.medianRevenueGrowth)}</td>
                  <td className="num">{pctCell(o.medianNetMargin)}</td>
                  <td className="num">{o.withData} of {o.companies}</td>
                  <td className="muted">{o.period ?? MISSING}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="data-time">{data.outlookSource}</p>
      </section>
    </div>
  );
}

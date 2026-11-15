export type ReviewStatus = 'draft' | 'reviewed' | 'outdated' | 'not available';

interface Props {
  /** Date of the newest evidence the review used (YYYY-MM-DD). */
  evidenceDate: string | null;
  sourceCount: number;
  status: ReviewStatus;
  score?: number | null;
  method?: string;
  summary?: string;
}

/** AI-generated explanation. Never shows buy/sell wording; shows the score and its method instead. */
export function AIReviewBox({ evidenceDate, sourceCount, status, score, method, summary }: Props) {
  return (
    <section className="card" aria-label="AI review">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <h3 className="card-title">AI review</h3>
        <span className="pill" style={{ color: 'var(--color-secondary)' }}>
          AI-generated
        </span>
      </div>
      {score != null && (
        <div>
          <span className="num" style={{ fontSize: 'var(--text-xl)', fontWeight: 600 }}>
            {score}
          </span>
          <span className="muted"> / 100 · experimental</span>
        </div>
      )}
      {method && <div className="muted" style={{ fontSize: 'var(--text-sm)' }}>Method: {method}</div>}
      {summary && <p style={{ fontSize: 'var(--text-sm)' }}>{summary}</p>}
      <dl className="data-time" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', margin: 0 }}>
        <div>
          <dt style={{ display: 'inline' }}>Evidence date: </dt>
          <dd style={{ display: 'inline', margin: 0 }} className="num">{evidenceDate ?? '—'}</dd>
        </div>
        <div>
          <dt style={{ display: 'inline' }}>Sources: </dt>
          <dd style={{ display: 'inline', margin: 0 }} className="num">{sourceCount}</dd>
        </div>
        <div>
          <dt style={{ display: 'inline' }}>Status: </dt>
          <dd style={{ display: 'inline', margin: 0 }}>{status}</dd>
        </div>
      </dl>
    </section>
  );
}

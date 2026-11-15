import type { ReactNode } from 'react';

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <p style={{ margin: 0, fontWeight: 600 }}>{title}</p>
      {children && <p className="muted" style={{ marginBottom: 0 }}>{children}</p>}
    </div>
  );
}

/** Skeleton only — no fake progress percentages. */
export function LoadingSkeleton({ lines = 3, label = 'Loading' }: { lines?: number; label?: string }) {
  return (
    <div className="card" role="status" aria-label={label}>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="skeleton" style={{ width: `${90 - i * 15}%` }} />
      ))}
    </div>
  );
}

/** Says what failed and what the user can do next. */
export function ErrorState({ what, next, onRetry }: { what: string; next: string; onRetry?: () => void }) {
  return (
    <div className="card" role="alert" style={{ borderColor: 'var(--color-loss)' }}>
      <p style={{ margin: 0, fontWeight: 600 }}>{what}</p>
      <p className="muted">{next}</p>
      {onRetry && (
        <button type="button" className="btn" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

/** Shown where a figure is missing. Never replaced by zero or a guess. */
export function DataGapNotice({ children }: { children: ReactNode }) {
  return (
    <div className="pill" style={{ color: 'var(--color-warn)', whiteSpace: 'normal' }}>
      <span aria-hidden="true">⚠</span> Not enough data: {children}
    </div>
  );
}

interface Props {
  /** 0–100, or null when there is not enough data. */
  pct: number | null;
  definition: string;
}

/** Half-circle gauge for a percentage built from our own breadth data (no third-party index). */
export function BreadthGauge({ pct, definition }: Props) {
  const w = 220;
  const r = 86;
  const cx = w / 2;
  const cy = 100;
  const arcLen = Math.PI * r;
  const filled = pct == null ? 0 : (Math.min(100, Math.max(0, pct)) / 100) * arcLen;
  const d = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  return (
    <div style={{ textAlign: 'center' }}>
      <svg width={w} height={118} viewBox={`0 0 ${w} 118`} role="img" aria-label={pct == null ? `${definition}: not enough data` : `${definition}: ${pct}%`}>
        <path d={d} fill="none" stroke="var(--color-card-raised)" strokeWidth="16" strokeLinecap="round" />
        {pct != null && (
          <path d={d} fill="none" stroke="var(--color-accent)" strokeWidth="16" strokeLinecap="round" strokeDasharray={`${filled} ${arcLen}`} />
        )}
        <text x={cx} y={cy - 14} textAnchor="middle" className="donut-value num">
          {pct == null ? '—' : `${pct}%`}
        </text>
        <text x={cx - r} y={cy + 16} textAnchor="middle" className="axis-label">0%</text>
        <text x={cx + r} y={cy + 16} textAnchor="middle" className="axis-label">100%</text>
      </svg>
      <p className="muted" style={{ fontSize: 'var(--text-sm)', margin: 0 }}>{definition}</p>
    </div>
  );
}

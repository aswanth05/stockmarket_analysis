import { useState } from 'react';

/** Categorical slots (validated for the dark card surface: CVD ΔE ≥ 8.4, contrast ≥ 3:1). */
export const SERIES_COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#9085e9'];
export const OTHER_COLOR = '#5b6583';

interface Slice {
  label: string;
  value: number;
}

interface Props {
  slices: Slice[];
  /** The last slice is drawn gray when it is an "Other" bucket. */
  lastIsOther?: boolean;
  centerLabel: string;
  format: (v: number) => string;
}

export function DonutChart({ slices, lastIsOther, centerLabel, format }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const total = slices.reduce((s, x) => s + x.value, 0);
  const size = 180;
  const r = 70;
  const stroke = 26;
  const circ = 2 * Math.PI * r;
  const color = (i: number) =>
    lastIsOther && i === slices.length - 1 ? OTHER_COLOR : SERIES_COLORS[i % SERIES_COLORS.length]!;

  const lens = slices.map((s) => (s.value / total) * circ);
  const arcs = lens.map((len, i) => ({ i, len, offset: lens.slice(0, i).reduce((a, b) => a + b, 0) }));
  const active = hover != null ? slices[hover] : undefined;

  return (
    <div className="donut">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${centerLabel}: ${slices.map((s) => `${s.label} ${format(s.value)}`).join(', ')}`}>
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {arcs.map(({ i, len, offset: off }) => (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={color(i)}
              strokeWidth={hover === i ? stroke + 6 : stroke}
              // 2px gap between segments
              strokeDasharray={`${Math.max(0, len - 2)} ${circ - Math.max(0, len - 2)}`}
              strokeDashoffset={-off}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </g>
        <text x="50%" y="46%" textAnchor="middle" className="donut-value num">
          {active ? format(active.value) : `${slices.length}`}
        </text>
        <text x="50%" y="58%" textAnchor="middle" className="axis-label">
          {active ? active.label.slice(0, 22) : centerLabel}
        </text>
      </svg>
      <ul className="legend legend-list">
        {slices.map((s, i) => (
          <li key={s.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <i style={{ background: color(i) }} />
            <span>{s.label}</span>
            <span className="num muted">{format(s.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

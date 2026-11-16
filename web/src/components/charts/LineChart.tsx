import { useState } from 'react';
import { shortDate, ticks, useElementWidth } from './useElementWidth';

interface Props {
  points: { date: string; value: number }[];
  /** Words for screen readers describing the series. */
  label: string;
  format: (v: number) => string;
  height?: number;
}

const PAD = { top: 12, right: 12, bottom: 24, left: 56 };

/** Single-series line with crosshair + tooltip on hover, and arrow-key stepping when focused. */
export function LineChart({ points, label, format, height = 240 }: Props) {
  const [wrapRef, width] = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return <p className="muted">Not enough data to draw this chart.</p>;

  const values = points.map((p) => p.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = (hi - lo) * 0.08 || 1;
  const yMin = lo - pad;
  const yMax = hi + pad;
  const innerW = width - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (i / (points.length - 1)) * innerW;
  const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * innerH;
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join('');
  const area = `${path}L${x(points.length - 1)},${PAD.top + innerH}L${x(0)},${PAD.top + innerH}Z`;
  const up = values[values.length - 1]! >= values[0]!;
  const stroke = up ? 'var(--color-gain)' : 'var(--color-loss)';
  const hp = hover != null ? points[hover] : undefined;

  const indexFromMouse = (clientX: number, rect: DOMRect) => {
    const i = Math.round(((clientX - rect.left - PAD.left) / innerW) * (points.length - 1));
    return Math.min(points.length - 1, Math.max(0, i));
  };

  return (
    <div ref={wrapRef} className="chart-wrap">
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={label}
        tabIndex={0}
        onMouseMove={(e) => setHover(indexFromMouse(e.clientX, e.currentTarget.getBoundingClientRect()))}
        onMouseLeave={() => setHover(null)}
        onBlur={() => setHover(null)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') setHover((h) => Math.max(0, (h ?? points.length) - 1));
          if (e.key === 'ArrowRight') setHover((h) => Math.min(points.length - 1, (h ?? -1) + 1));
        }}
      >
        <defs>
          <linearGradient id="line-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.18" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks(yMin, yMax).map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} className="grid-line" />
            <text x={PAD.left - 8} y={y(t)} className="axis-label" textAnchor="end" dominantBaseline="middle">
              {format(t)}
            </text>
          </g>
        ))}
        <text x={PAD.left} y={height - 6} className="axis-label">
          {shortDate(points[0]!.date)}
        </text>
        <text x={width - PAD.right} y={height - 6} className="axis-label" textAnchor="end">
          {shortDate(points[points.length - 1]!.date)}
        </text>
        <path d={area} fill="url(#line-fill)" />
        <path d={path} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" />
        {hp && hover != null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerH} className="crosshair" />
            <circle cx={x(hover)} cy={y(hp.value)} r="5" fill={stroke} stroke="var(--color-card)" strokeWidth="2" />
          </g>
        )}
      </svg>
      {hp && hover != null && (
        <div
          className="chart-tooltip"
          style={{ left: Math.min(x(hover) + 12, width - 150), top: PAD.top }}
          role="status"
        >
          <div className="muted">{shortDate(hp.date)}</div>
          <div className="num">{format(hp.value)}</div>
        </div>
      )}
    </div>
  );
}

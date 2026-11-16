import { useState } from 'react';
import { SERIES_COLORS } from './DonutChart';
import { ticks, useElementWidth } from './useElementWidth';

interface Props {
  groups: { label: string; values: [number, number] }[];
  seriesNames: [string, string];
  axisLabel: string;
  format: (v: number) => string;
  height?: number;
}

const PAD = { top: 16, right: 8, bottom: 40, left: 72 };
const COLORS = [SERIES_COLORS[0]!, SERIES_COLORS[1]!];

/** Two bars per group around a zero baseline (values can be negative). */
export function GroupedBars({ groups, seriesNames, axisLabel, format, height = 240 }: Props) {
  const [wrapRef, width] = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<{ g: number; s: number } | null>(null);
  const all = groups.flatMap((g) => g.values);
  const yMin = Math.min(0, ...all);
  const yMax = Math.max(0, ...all);
  const innerW = width - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;
  const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin || 1)) * innerH;
  const groupW = innerW / groups.length;
  const barW = Math.min(22, (groupW - 12) / 2);
  const hv = hover ? groups[hover.g] : undefined;

  return (
    <div>
      <div className="legend">
        {seriesNames.map((n, i) => (
          <span key={n}><i style={{ background: COLORS[i] }} /> {n}</span>
        ))}
      </div>
      <div ref={wrapRef} className="chart-wrap">
        <svg width={width} height={height} role="img" aria-label={`${axisLabel}. ${groups.map((g) => `${g.label}: ${seriesNames[0]} ${format(g.values[0])}, ${seriesNames[1]} ${format(g.values[1])}`).join('; ')}`}>
          {ticks(yMin, yMax).map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} className={t === 0 ? 'zero-line' : 'grid-line'} />
              <text x={PAD.left - 8} y={y(t)} className="axis-label" textAnchor="end" dominantBaseline="middle">
                {format(t)}
              </text>
            </g>
          ))}
          <text transform={`translate(12 ${PAD.top + innerH / 2}) rotate(-90)`} textAnchor="middle" className="axis-label">
            {axisLabel}
          </text>
          {groups.map((g, gi) => {
            const cx = PAD.left + groupW * (gi + 0.5);
            return (
              <g key={g.label}>
                {g.values.map((v, si) => {
                  const bx = cx + (si === 0 ? -barW - 1 : 1);
                  const top = Math.min(y(v), y(0));
                  const h = Math.max(1, Math.abs(y(v) - y(0)));
                  return (
                    <g key={si} onMouseEnter={() => setHover({ g: gi, s: si })} onMouseLeave={() => setHover(null)}>
                      <rect x={bx - 3} y={PAD.top} width={barW + 6} height={innerH} fill="transparent" />
                      <rect x={bx} y={top} width={barW} height={h} rx="3" fill={COLORS[si]} opacity={hover && (hover.g !== gi || hover.s !== si) ? 0.5 : 1} />
                    </g>
                  );
                })}
                <text x={cx} y={height - PAD.bottom + 16} textAnchor="middle" className="axis-label">
                  {g.label.length > 11 && groupW < 90 ? `${g.label.slice(0, 9)}…` : g.label}
                </text>
              </g>
            );
          })}
        </svg>
        {hover && hv && (
          <div className="chart-tooltip" role="status" style={{ left: Math.min(PAD.left + groupW * (hover.g + 0.5), width - 160), top: 0 }}>
            <div className="muted">{hv.label}</div>
            <div><i className="swatch" style={{ background: COLORS[hover.s] }} /> {seriesNames[hover.s]}: <span className="num">{format(hv.values[hover.s]!)}</span></div>
          </div>
        )}
      </div>
    </div>
  );
}

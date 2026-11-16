import { useState } from 'react';
import { formatPrice } from '../../format';
import { shortDate, ticks, useElementWidth } from './useElementWidth';

export interface Candle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface Props {
  candles: Candle[];
  ma50: (number | null)[];
  ma200: (number | null)[];
  label: string;
  height?: number;
}

const PAD = { top: 12, right: 12, bottom: 24, left: 56 };
const MA50_COLOR = '#3987e5';
const MA200_COLOR = '#d95926';

const volFmt = (v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v.toLocaleString('en-US'));

/** Daily candles, volume bars and 50/200-day moving averages, with an OHLCV readout for the hovered day. */
export function CandleChart({ candles, ma50, ma200, label, height = 320 }: Props) {
  const [wrapRef, width] = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  if (candles.length < 2) return <p className="muted">Not enough data to draw this chart.</p>;

  const innerW = width - PAD.left - PAD.right;
  const volH = 56;
  const priceH = height - PAD.top - PAD.bottom - volH - 8;
  const lows = candles.map((c) => c.low);
  const highs = candles.map((c) => c.high);
  const maVals = [...ma50, ...ma200].filter((v): v is number => v != null);
  const yMin = Math.min(...lows, ...maVals);
  const yMax = Math.max(...highs, ...maVals);
  const vMax = Math.max(...candles.map((c) => c.volume));
  const step = innerW / candles.length;
  const bodyW = Math.max(1, Math.min(10, step * 0.6));
  const x = (i: number) => PAD.left + step * (i + 0.5);
  const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * priceH;
  const volTop = PAD.top + priceH + 8;

  const maPath = (vals: (number | null)[]) =>
    vals
      .map((v, i) => (v == null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`))
      .reduce<string>((d, pt, i) => (pt == null ? d : d + (vals[i - 1] == null ? 'M' : 'L') + pt), '');

  const shown = hover ?? candles.length - 1;
  const c = candles[shown]!;

  return (
    <div>
      <div className="ohlc-readout num" aria-live="polite">
        <span className="muted">{shortDate(c.date)}</span>
        <span>O {formatPrice(c.open)}</span>
        <span>H {formatPrice(c.high)}</span>
        <span>L {formatPrice(c.low)}</span>
        <span>C {formatPrice(c.close)}</span>
        <span>Vol {volFmt(c.volume)}</span>
      </div>
      <div ref={wrapRef} className="chart-wrap">
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={label}
          tabIndex={0}
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const i = Math.floor((e.clientX - r.left - PAD.left) / step);
            setHover(Math.min(candles.length - 1, Math.max(0, i)));
          }}
          onMouseLeave={() => setHover(null)}
          onBlur={() => setHover(null)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') setHover((h) => Math.max(0, (h ?? candles.length) - 1));
            if (e.key === 'ArrowRight') setHover((h) => Math.min(candles.length - 1, (h ?? -1) + 1));
          }}
        >
          {ticks(yMin, yMax).map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} className="grid-line" />
              <text x={PAD.left - 8} y={y(t)} className="axis-label" textAnchor="end" dominantBaseline="middle">
                {formatPrice(t)}
              </text>
            </g>
          ))}
          {candles.map((k, i) => {
            const up = k.close >= k.open;
            const color = up ? 'var(--color-gain)' : 'var(--color-loss)';
            const top = y(Math.max(k.open, k.close));
            const h = Math.max(1, Math.abs(y(k.open) - y(k.close)));
            const vh = (k.volume / vMax) * volH;
            return (
              <g key={k.date} opacity={hover == null || hover === i ? 1 : 0.55}>
                <line x1={x(i)} x2={x(i)} y1={y(k.high)} y2={y(k.low)} stroke={color} strokeWidth="1" />
                <rect x={x(i) - bodyW / 2} y={top} width={bodyW} height={h} fill={up ? 'var(--color-card)' : color} stroke={color} strokeWidth="1" />
                <rect x={x(i) - bodyW / 2} y={volTop + volH - vh} width={bodyW} height={vh} fill={color} opacity="0.35" />
              </g>
            );
          })}
          <path d={maPath(ma50)} fill="none" stroke={MA50_COLOR} strokeWidth="2" />
          <path d={maPath(ma200)} fill="none" stroke={MA200_COLOR} strokeWidth="2" />
          {hover != null && (
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={volTop + volH} className="crosshair" />
          )}
          <text x={PAD.left - 8} y={volTop + volH / 2} className="axis-label" textAnchor="end" dominantBaseline="middle">
            Vol
          </text>
          <text x={PAD.left} y={height - 6} className="axis-label">
            {shortDate(candles[0]!.date)}
          </text>
          <text x={width - PAD.right} y={height - 6} className="axis-label" textAnchor="end">
            {shortDate(candles[candles.length - 1]!.date)}
          </text>
        </svg>
      </div>
      <div className="legend">
        <span><i style={{ background: MA50_COLOR }} /> 50-day average</span>
        <span><i style={{ background: MA200_COLOR }} /> 200-day average</span>
        <span><i style={{ background: 'var(--color-gain)' }} /> Close above open (hollow)</span>
        <span><i style={{ background: 'var(--color-loss)' }} /> Close below open (filled)</span>
      </div>
    </div>
  );
}

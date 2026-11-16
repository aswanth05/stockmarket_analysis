/** Display helpers. Missing values render as a dash, never as zero. */

export const MISSING = '—';

export function formatPrice(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return MISSING;
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export interface ChangeDisplay {
  text: string;
  arrow: '▲' | '▼' | '';
  tone: 'gain' | 'loss' | 'flat' | 'missing';
  /** Words for screen readers, so meaning never depends on color or arrow glyphs. */
  spoken: string;
}

export function formatChangePct(value: number | null | undefined): ChangeDisplay {
  if (value == null || !Number.isFinite(value)) {
    return { text: MISSING, arrow: '', tone: 'missing', spoken: 'change not available' };
  }
  const abs = Math.abs(value).toFixed(2);
  if (value > 0) return { text: `+${abs}%`, arrow: '▲', tone: 'gain', spoken: `up ${abs} percent` };
  if (value < 0) return { text: `-${abs}%`, arrow: '▼', tone: 'loss', spoken: `down ${abs} percent` };
  return { text: '0.00%', arrow: '', tone: 'flat', spoken: 'unchanged' };
}

/** Large dollar amounts as reported: $416.2B, $12.7M. Negative values keep their sign. */
export function formatUsdBig(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return MISSING;
  const a = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (a >= 1e12) return `${sign}$${(a / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(1)}M`;
  return `${sign}$${a.toLocaleString('en-US')}`;
}

/** A ratio (0.153) as a percent (15.3%). */
export function formatRatioPct(value: number | null | undefined, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return MISSING;
  return `${(value * 100).toFixed(digits)}%`;
}

/** A percent number (5.2) with sign: +5.20%. */
export function formatSignedPct(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return MISSING;
  return `${value > 0 ? '+' : value < 0 ? '-' : ''}${Math.abs(value).toFixed(digits)}%`;
}

/** YYYY-MM-DD → "Nov 13, 2026" */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return MISSING;
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return MISSING;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: iso.length === 10 ? 'UTC' : 'America/New_York' });
}

/** Format an ISO time in US Eastern Time, e.g. "Nov 14, 4:00 PM ET". */
export function formatEt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return MISSING;
  return (
    d.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }) + ' ET'
  );
}

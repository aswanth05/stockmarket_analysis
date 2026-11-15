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

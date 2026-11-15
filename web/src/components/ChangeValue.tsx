import { formatChangePct } from '../format';

/** A percent change shown with sign, arrow and color, plus words for screen readers. */
export function ChangeValue({ pct }: { pct: number | null }) {
  const c = formatChangePct(pct);
  const cls = c.tone === 'gain' ? 'gain' : c.tone === 'loss' ? 'loss' : 'muted';
  return (
    <span className={`num ${cls}`}>
      <span aria-hidden="true">
        {c.arrow && `${c.arrow} `}
        {c.text}
      </span>
      <span className="visually-hidden">{c.spoken}</span>
    </span>
  );
}

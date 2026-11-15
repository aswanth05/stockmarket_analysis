interface Props {
  source: string;
  form?: string;
  /** YYYY-MM-DD */
  filed?: string;
  href?: string;
}

/** e.g. "EDGAR, 10-K, filed 2026-02-14" */
export function SourceChip({ source, form, filed, href }: Props) {
  const text = [source, form, filed && `filed ${filed}`].filter(Boolean).join(', ');
  return href ? (
    <a className="pill" href={href} target="_blank" rel="noreferrer" style={{ color: 'var(--color-secondary)' }}>
      {text}
      <span className="visually-hidden"> (opens source in a new tab)</span>
    </a>
  ) : (
    <span className="pill muted">{text}</span>
  );
}

import { useId, useState, type ReactNode } from 'react';

interface Props {
  formula: string;
  inputs: { label: string; value: string }[];
  period: string;
  source: string;
  children: ReactNode;
}

/** Shows how a number was calculated, on hover or keyboard focus. */
export function FormulaTooltip({ formula, inputs, period, source, children }: Props) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span
      className="tooltip-wrap"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="tooltip-trigger num"
        aria-describedby={id}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
      >
        {children}
      </button>
      <span role="tooltip" id={id} className="tooltip" hidden={!open}>
        <strong>{formula}</strong>
        <span style={{ display: 'block', marginTop: 4 }}>
          {inputs.map((i) => (
            <span key={i.label} style={{ display: 'block' }}>
              {i.label}: <span className="num">{i.value}</span>
            </span>
          ))}
        </span>
        <span className="muted" style={{ display: 'block', marginTop: 4 }}>
          Period: {period} · Source: {source}
        </span>
      </span>
    </span>
  );
}

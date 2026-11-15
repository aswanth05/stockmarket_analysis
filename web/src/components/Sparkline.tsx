interface Props {
  values: number[];
  /** Text summary for screen readers. */
  label: string;
  width?: number;
  height?: number;
}

export function Sparkline({ values, label, width = 120, height = 32 }: Props) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values
    .map((v, i) => `${(i / (values.length - 1)) * width},${height - ((v - min) / span) * (height - 4) - 2}`)
    .join(' ');
  const up = values[values.length - 1]! >= values[0]!;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
      <polyline
        points={points}
        fill="none"
        stroke={up ? 'var(--color-gain)' : 'var(--color-loss)'}
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

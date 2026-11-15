import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { findBannedWording } from '@ust/shared';
import { Gallery } from '../gallery/Gallery';
import { formatChangePct, formatPrice } from '../format';
import { FreshnessBadge } from './FreshnessBadge';
import { SummaryCard } from './SummaryCard';
import { DataTable } from './DataTable';

describe('format helpers never turn missing data into zero', () => {
  it('formats null price as a dash', () => {
    expect(formatPrice(null)).toBe('—');
    expect(formatPrice(Number.NaN)).toBe('—');
  });

  it('gives change a sign and arrow, not just color', () => {
    expect(formatChangePct(1.5)).toMatchObject({ text: '+1.50%', arrow: '▲', tone: 'gain' });
    expect(formatChangePct(-2)).toMatchObject({ text: '-2.00%', arrow: '▼', tone: 'loss' });
    expect(formatChangePct(null)).toMatchObject({ text: '—', tone: 'missing' });
  });
});

describe('FreshnessBadge', () => {
  it('labels delayed data as delayed, never as real-time', () => {
    render(<FreshnessBadge freshness="delayed" delayMinutes={15} asOf="2026-11-13T21:00:00Z" />);
    expect(screen.getByText(/Delayed 15 min/)).toBeInTheDocument();
    expect(screen.queryByText(/Real-time/i)).not.toBeInTheDocument();
  });

  it('shows the last time when stale', () => {
    render(<FreshnessBadge freshness="stale" asOf="2026-11-13T21:00:00Z" />);
    expect(screen.getByText(/last Nov 13, 4:00 PM ET/)).toBeInTheDocument();
  });
});

describe('SummaryCard', () => {
  it('shows a dash and "Not enough data" instead of zero', () => {
    render(<SummaryCard title="X" value={null} asOf="2026-11-13T21:00:00Z" source="S" />);
    const card = screen.getByRole('region', { name: 'X' });
    expect(within(card).getByText('—')).toBeInTheDocument();
    expect(within(card).getByText('Not enough data')).toBeInTheDocument();
    expect(within(card).queryByText(/\b0\b/)).not.toBeInTheDocument();
  });

  it('always shows its data time and source', () => {
    render(<SummaryCard title="Y" value="$1.00" asOf="2026-11-13T21:00:00Z" source="EODHD" />);
    expect(screen.getByText(/As of Nov 13, 4:00 PM ET · EODHD/)).toBeInTheDocument();
  });
});

describe('DataTable', () => {
  const rows = [
    { t: 'A', v: 2 as number | null },
    { t: 'B', v: null },
    { t: 'C', v: 5 },
  ];
  const cols = [
    { key: 't', header: 'T', render: (r: (typeof rows)[number]) => r.t },
    { key: 'v', header: 'V', sortValue: (r: (typeof rows)[number]) => r.v, render: (r: (typeof rows)[number]) => String(r.v ?? '—') },
  ];

  it('sorts by column and keeps missing values last', () => {
    render(<DataTable caption="t" columns={cols} rows={rows} rowKey={(r) => r.t} />);
    const order = () => screen.getAllByRole('row').slice(1).map((r) => r.firstChild?.textContent);
    fireEvent.click(screen.getByRole('button', { name: /V/ }));
    expect(order()).toEqual(['C', 'A', 'B']);
    fireEvent.click(screen.getByRole('button', { name: /V/ }));
    expect(order()).toEqual(['A', 'C', 'B']);
    expect(screen.getByRole('columnheader', { name: /V/ })).toHaveAttribute('aria-sort', 'ascending');
  });
});

describe('Gallery', () => {
  it('renders every component example without recommendation wording or crypto labels', () => {
    const { container } = render(<Gallery />);
    const text = container.textContent ?? '';
    expect(findBannedWording(text)).toEqual([]);
    expect(text).not.toMatch(/\b(BTC|ETH|USDT|crypto\w*)\b/i);
    expect(screen.getAllByRole('region', { name: 'AI review' })).toHaveLength(2);
  });
});

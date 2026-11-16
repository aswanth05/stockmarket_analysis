import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { findBannedWording } from '@ust/shared';
import { SampleHomeScreen as HomeScreen } from './SampleHomeScreen';
import { sma } from './sampleData';

describe('HomeScreen (step 30, placeholder data)', () => {
  it('has no buy/sell wording and no crypto labels', () => {
    const { container } = render(<HomeScreen />);
    const text = container.textContent ?? '';
    expect(findBannedWording(text)).toEqual([]);
    expect(text).not.toMatch(/\b(BTC|ETH|USDT|crypto\w*)\b/i);
  });

  it('says plainly that the numbers are samples', () => {
    render(<HomeScreen />);
    expect(screen.getByRole('note')).toHaveTextContent(/sample data, not real market prices/i);
  });

  it('shows a data time and source on every card', () => {
    render(<HomeScreen />);
    const cards = [
      'S&P 500 (SPY proxy)',
      'Market breadth',
      'Watchlist: new filings or events',
      'Watchlist companies',
      'Index ETF proxies',
      'Sector breakdown',
      'Market breadth gauge',
      'Top markets',
      'Daily price chart',
      'Weekly comparison',
      'Recent activity',
    ];
    for (const name of cards) {
      const card = screen.getByRole('region', { name });
      expect(within(card).getAllByText(/Sample data/).length, name).toBeGreaterThan(0);
    }
  });

  it('labels index ETFs as proxies and disables ranges with no data, saying why', () => {
    render(<HomeScreen />);
    expect(screen.getByText('ETF proxy')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1H' })).toBeDisabled();
    expect(screen.getByText(/1H unavailable: intraday data is not connected yet/)).toBeInTheDocument();
  });

  it('shows a dash, not zero, for a stock with no price', () => {
    render(<HomeScreen />);
    const row = screen.getByText('UNH').closest('tr')!;
    expect(within(row).getAllByText('—').length).toBeGreaterThan(0);
    expect(row.textContent).not.toMatch(/\$0\.00/);
  });
});

describe('sma', () => {
  it('returns null until there are enough values, never a partial average', () => {
    expect(sma([1, 2, 3, 4], 3)).toEqual([null, null, 2, 3]);
  });
});

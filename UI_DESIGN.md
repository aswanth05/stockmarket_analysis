# US Stock Terminal: UI Design Brief

Reference mockup: the "TradeVision" dashboard image shared in chat. Use its layout and visual style. Do not copy its content, because it shows crypto pairs, a "Strong Buy" signal, a win rate, and a sentiment gauge with no defined source. Those parts must be replaced as described below.

## 1. Visual style

- Dark theme with a deep navy-black background and slightly lighter cards.
- Green for gains, red for losses. Never rely on color alone: always pair it with a sign (+ or -) and an arrow.
- One accent color (teal or green) for buttons, active tabs, and the logo.
- A secondary color (purple or blue) for neutral metrics and the donut chart.
- Numbers use a monospaced font so digits line up in tables and cards. Text uses a clean sans-serif font.
- Glow and neon effects are decoration only. Keep them subtle and turn them off for reduced-motion users.
- Contrast must meet WCAG AA for all text. Check every color pair before approving the design.

## 2. Layout and navigation

Desktop (wide screen):
- Left sidebar with the logo and navigation. It can collapse to icons.
- Top bar with: market status (open, closed, pre-market, after-hours) and the current Eastern Time, a data-freshness badge (real-time, delayed 15 min, or stale with its time), a notifications bell, and an account menu. Remove the currency dropdown, because the app is USD only.
- Main content as a card grid. Cards align to a consistent spacing rule.

Sidebar items (mapped from the mockup):
- Home (replaces Dashboard)
- Stock Research
- Stock Screener
- Sector Analysis
- My Watchlist
- Methodology and Sources
- Settings
- Remove "Portfolio", "Signals", and "Analytics" for version 1. Portfolio can return later as read-only account data.

Tablet: two-column card grid, sidebar collapsed to icons.

Phone: one column, bottom navigation for the five main screens, and a menu for Settings and Sources.

## 3. Home screen (adapted from the mockup)

Top row, four summary cards with a small sparkline each. Each card shows its data time.
- Replace "Total Portfolio" with the S&P 500 proxy (SPY) with its daily change.
- Replace "24H P/L" with market breadth: number of advancing and declining stocks in the saved S&P 500 list.
- Replace "Win Rate" with the number of watchlist companies that have a new filing or event. Do not show a win rate unless it comes from a tested, disclosed backtest.
- Replace "Active Positions" with the watchlist count.

Index chart (replaces "Portfolio Performance"):
- Show S&P 500, Dow, and Nasdaq ETF proxies (SPY, DIA, QQQ) with a selector.
- Keep the time range tabs (1H, 1D, 1W, 1M, 3M, 1Y). Disable 1H if no intraday data is available, and say so.
- Label every chart as delayed or real-time, with the time of the last point.

Sector breakdown (replaces "Asset Allocation"):
- A donut of the sector weights for the saved S&P 500 list, or of the user's watchlist. Label which one it is.

Market sentiment (replaces the gauge labelled "Greed"):
- Do not use a third-party sentiment index. Its licensing and naming are unclear.
- Use a gauge built from our own breadth data, labelled with its definition, such as "share of stocks above their 50-day average".

Top markets table:
- A table of US stocks and ETFs with last price, change, and a sparkline. Sortable columns. Tickers only, no crypto.

Research summary (replaces "AI Signal: Strong Buy"):
- A box labelled "AI review" with the evidence date, the number of sources, and the reviewer status.
- Do not use buy, sell, or strong-buy wording. Show the score and its method instead.

Trading chart (replaces the crypto candle chart):
- Daily candles with volume bars, and moving-average lines (50-day and 200-day, as defined in the project rules).
- Stock selector at the top. Show the open, high, low, close, and volume for the hovered candle.

Weekly comparison (replaces "Performance"):
- Bars for this week and last week, comparing sector returns or index returns. Label the axis clearly.

Recent activity (replaces "Recent Activity"):
- Recent filings and company events for watchlist companies, such as 10-Q, 10-K, and 8-K filings, each with its date and a link to the source.

Footer strip (replaces the feature icons):
- Use only claims the app can support. "Real-time market data" appears only if the data license allows it. Otherwise write "Delayed market data". Remove "Multi-asset support". Keep "Encrypted" only if it is true for stored data and sessions.

## 4. Other screens to design

- Login and sign-up: simple form, password rules shown, clear error messages.
- Stock Research: company header (name, ticker, exchange, sector), Long Term and Swing Trading tabs, financial charts with formulas on hover, factor scores with weights, AI review panel, risks, and sources.
- Stock Screener: filter panel on the left, results table on the right, with the active filters shown above the results.
- Sector Analysis: two clearly separated areas, one for recent price movement and one for the business outlook.
- My Watchlist: saved companies, each with its latest price, data date, and research status. Search narrows the list.
- Methodology and Sources: every formula, its inputs, and each data source with its update time.
- Settings: account details, password change, and data-source status.

## 5. Components to build once and reuse

- Summary card with sparkline and data time
- Chart panel with range tabs and a data-time label
- Freshness badge (real-time, delayed, stale)
- Market status pill
- Source chip (for example, "EDGAR, 10-K, filed 2026-02-14")
- Formula tooltip showing inputs and period
- AI review box with its date and status
- Sortable data table
- Search box with autocomplete for tickers and company names
- Empty state, loading state, error state, and data-gap notice

## 6. Required states

- Market closed: show the last close and its date. Do not show a live-looking price.
- Stale data: show the last valid value, its time, and a clear stale marker.
- Missing data: show "not enough data" or a dash. Never show zero or a guessed value.
- Loading: a simple skeleton layout. No fake progress percentages.
- Error: explain what failed and what the user can do next.

## 7. Responsive and accessibility rules

- Every control works by keyboard, with a visible focus outline.
- Charts have text summaries for screen readers.
- Tables have proper headers.
- Motion respects the reduced-motion setting.
- Phone layout checked at a narrow width before approval.
- Decorative background graphics are turned off on phones and for reduced-motion users to save battery and speed up loading.

## 8. Design process

1. Make wireframes for the Home, Stock Research, Screener, and Login screens.
2. Define the design system: colors, type sizes, spacing, and the components above.
3. Review the wireframes on desktop and phone sizes. Check contrast.
4. Approve the design before any frontend work begins.
5. Build the components first, then the screens, then connect the real data.

## 9. Brand check

- The name "TradeVision" appears in the mockup. Search for existing trademarks with that name before using it publicly. Keep the name private until the check is done.

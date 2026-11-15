# US Stock Market Terminal: Project Instructions

## Goal

A browser-based terminal for US stocks. A user logs in and sees quotes, charts, index levels, and market movers. Every quote shows its timestamp and whether it is real-time or delayed.

## Scope: US markets only

- Exchanges: NYSE and Nasdaq listings only. OTC is out of scope for v1.
- Indexes: S&P 500, Dow Jones Industrial Average, Nasdaq Composite.
- All money is in USD. No currency conversion.
- Primary key: US ticker symbol. Store CUSIP or ISIN where a provider supplies them, for matching only.
- Out of scope for v1: placing trades, brokerage accounts, options chains, crypto, and any non-US market or ticker.

## Market rules

- All market logic uses the America/New_York time zone.
- Regular session: 9:30 to 16:00 ET, weekdays. Confirm pre-market and after-hours windows with the chosen data provider before coding them.
- Holidays and early closes come from an official NYSE holiday calendar. Store the calendar as data. Do not hardcode dates.
- The UI shows market status: open, closed, pre-market, or after-hours.

## Data rules

- Live and delayed quotes come only from a licensed data provider. Record the provider, the timestamp, and whether the quote is real-time or delayed.
- Do not scrape exchange websites for prices. Follow provider terms and rate limits.
- Real-time US exchange data usually requires a paid, licensed feed with display agreements. Free sources are typically delayed or end-of-day. Confirm which one the project uses before building the live layer.
- If a provider call fails, keep the last valid value, mark it stale, and show its time. Never fill a gap with zero or a guess.
- Company financials come from SEC EDGAR filings (10-K, 10-Q, 8-K, and XBRL company facts). Store the accession number, filing date, and period end for each figure.
- Keep the units a filing uses (thousands or millions). Convert them explicitly in code.
- Fiscal years differ by company. Label each one with its real period end.

## Calculations

- Calculations run in backend code. AI models never compute numbers.
- Every displayed figure shows its formula, inputs, period, and source.
- Start with these measures: revenue growth, net profit margin, return on equity, and free cash flow. Define each one in a versioned file.
- Handle zero and negative denominators explicitly.
- Any score is experimental until it has been tested. Label it that way in the UI.

## Accounts, security, and storage

- Users log in before any terminal screen is shown.
- Passwords are hashed with bcrypt or argon2. Sessions use httpOnly cookies. Login attempts are rate limited.
- All API keys stay on the server. The browser never receives them.
- Watchlists are stored on the server per user account, not in browser local storage.
- Log data-provider usage and errors. Log no secrets.

## Proposed stack (confirm before building)

- Frontend: React, TypeScript, Vite.
- Backend: Node.js with Express.
- Database: SQLite for v1. Revisit when user count grows.
- Live updates: WebSocket or polling, chosen after the data provider is picked.
- Charts: a charting library that supports OHLC candles and volume.
- AI: Claude only for v1, through the Anthropic API. Add other models later, if at all.

## AI rules

- AI may explain evidence and draft written analysis. It may not invent prices, figures, or sources.
- Every AI output is labelled as AI-generated. It shows the evidence it used and the date of that evidence.
- Set a monthly spending limit on the API key. Stop new calls when the limit is reached.

## Build order

1. Scaffold the project: folder structure, linting, tests, and version control.
2. Accounts and login.
3. Market data service that wraps the chosen provider.
4. US market calendar and Eastern Time handling.
5. Quote storage with timestamps and staleness rules.
6. Watchlist.
7. Quote detail panel and OHLC chart.
8. Top movers and index panels.
9. Live update layer.
10. EDGAR financial data and the calculation definitions.
11. Claude explanations, optional.
12. Deployment.

After each step: run the tests, check the screens in a browser, and record what changed.

## Open decisions (ask the user before building)

- Data provider and budget: free delayed data or paid real-time.
- Hosting provider.
- Whether any stock picks or ratings are shown to the public. Get legal review first. This is not legal advice.

## Do not carry over from the Indian research guide

The reference document ("Super Market Intelligence") is built for Indian markets. Do not reuse these parts:

- NSE and BSE exchanges, Indian ISIN-only matching, and rupee or crore units.
- NBFC and bank scoring rules. US banks and insurers need their own definitions, if they are included at all.
- Rupee liquidity thresholds and the "top 1,000" selection rule. Define any US universe explicitly, such as S&P 500 membership.
- Four AI review providers. Start with Claude only.
- The Grok bot connection. Leave it out of v1.

Keep these ideas from the guide: backend-only calculations, saved sources with dates, freshness rules, no invented data, showing formulas and inputs, and keeping AI judgment separate from calculated results.

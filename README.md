# US Stock Terminal

A private, research-only terminal for NYSE and Nasdaq stocks: market overview, company research from SEC filings, a stock screener, sector analysis, a watchlist, and optional AI-written summaries. No trading, and no buy or sell recommendations.

See [PROJECT_STEPS.md](PROJECT_STEPS.md) for the plan, [CLAUDE.md](CLAUDE.md) for technical rules, [UI_DESIGN.md](UI_DESIGN.md) for screen rules, and [PROGRESS.md](PROGRESS.md) for status.

## Run it locally

Requires Node.js 24 or newer (installed here at `~/.local/node`). If `node -v` fails in a new terminal, add this line to `~/.zshrc`:

```sh
export PATH="$HOME/.local/node/bin:$PATH"
```

Then:

```sh
npm install        # first time only
npm run dev        # API on http://localhost:3001, web app on http://localhost:5173
```

Open http://localhost:5173 and create your account. The first account can always be created; after that, sign-up is closed unless `ALLOW_SIGNUP=true`.

## Connect data

Copy `.env.example` to `server/.env` (already done here) and fill in the values from your password manager, then restart `npm run dev`. Each source is optional; screens that need a missing source say so instead of showing guessed numbers.

| Setting | Turns on |
|---|---|
| `ALPACA_API_KEY_ID`, `ALPACA_API_SECRET_KEY` | Live quotes (IEX exchange) and daily price history for the S&P 500 list, index ETFs and watchlists |
| `EODHD_API_TOKEN` | Delayed fallback quotes and history (free plan: few calls a day) |
| `SEC_EDGAR_USER_AGENT` | Company financials, filings, exchanges, screener and sector fundamentals. Value: your name and email, e.g. `Jane Doe jane@example.com` |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MONTHLY_BUDGET_USD` | AI reviews (Claude). Both are required; reviews stop when the monthly cap is reached |

Keys are read only by `server/src/config.ts`. They are never sent to the browser or logged.

## Checks

```sh
npm test           # all tests (shared, server, web)
npm run typecheck
npm run lint
```

## Data refresh

- Quotes refresh every minute while any session is running, hourly when the market is closed.
- Daily prices are filled up to the last completed trading day every 30 minutes.
- SEC ticker list and calendar-year fundamentals refresh weekly; watchlist filings every 6 hours.
- The S&P 500 list is stored in `server/data/sp500.json`. Refresh it with `npm run update:sp500 -w server`.
- Market holidays are stored in `server/data/nyse-calendar.json` (2026–2028, from nyse.com). Add later years from the same page.

## Deploy privately (step 44)

`render.yaml` describes one Render web service that runs the API and serves the built web app.

1. Create a Render account and choose **New → Blueprint**, pointing at this GitHub repo.
2. Enter each key when Render asks (they are marked secret in `render.yaml`).
3. Keep the persistent disk: SQLite stores accounts and watchlists there. It needs a paid Render plan; on the free plan data is lost on each deploy.

The GitHub Pages site (`.github/workflows/pages.yml`) is only a public static preview with sample data. It cannot log in or load live data.

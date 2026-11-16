# Progress Log

Step numbers refer to [PROJECT_STEPS.md](PROJECT_STEPS.md). Build order follows PROJECT_STEPS.md (steps 27–44) where it differs from CLAUDE.md.

## 2026-11-15: Part D, steps 17–21 (project setup)

**What changed**
- Added CLAUDE.md, UI_DESIGN.md and PROJECT_STEPS.md to the root.
- Created the approved folder structure (`design/`, `shared/`, `server/`, `web/`) with empty placeholder folders.
- Added `.gitignore` (blocks `.env` files and local databases) and `.env.example` (key names only, no values).
- Removed the empty `reference/` folder; the mockup goes in `design/reference/`.
- Folder name kept as `stockmarket_analysis`.

**What was tested**
- Nothing to run yet. Checked that `.env` files are ignored by Git.

**Open items**
- Node.js LTS is not installed (Part B, step 6). Needed before step 27.
- Mockup image not yet in `design/reference/`.
- Alpaca free tier is IEX-only real-time; confirm terms and labelling at step 31.
- Hosting provider undecided (needed at step 44).

**What comes next**
- Part E: wireframes and design system (steps 22–26), then step 27, Scaffold.

## 2026-11-15: Step 27, Scaffold (run ahead of Part E at the user's request)

**What changed**
- Installed Node.js v26.13.1 LTS into `~/.local/node` (checksum verified). `~/.zshrc` was not changed; see README for the PATH line.
- npm workspaces: `shared` (types, banned-wording check), `server` (Express 5, `/api/health`), `web` (React 19 + Vite 8).
- `server/src/config.ts` is the only place secrets are read, from `server/.env`.
- Design tokens in `web/src/styles/tokens.css`. **Provisional**: Part E design approval is still pending.
- All UI_DESIGN §5 components built and shown in a gallery with sample data and placeholder tickers (SMPA–SMPD): SummaryCard, Sparkline, ChartPanel, FreshnessBadge, MarketStatusPill, SourceChip, FormulaTooltip, AIReviewBox, DataTable, TickerSearch, and the empty/loading/error/data-gap states.
- ESLint, Prettier, Vitest set up. README has run instructions.

**What was tested**
- 39 tests pass: wording check (3), API health (3), web (33). The web tests check WCAG AA contrast for every text/background token pair, that missing values show a dash and never 0, that delayed data is never labelled real-time, that table sorting keeps missing values last, and that the gallery has no buy/sell or crypto wording.
- Typecheck and lint pass.
- `npm run dev`: both servers start without errors; `/api/health` answers directly and through the web proxy.

**Open items**
- Part E (wireframes, design approval) not done. Tokens and component looks may change after it.
- `npm audit`: 7 moderate findings, all in dev-only lint tooling (minimatch via typescript-eslint). Nothing shipped to the browser or server. Revisit when typescript-eslint publishes a fix.
- The chart library (`lightweight-charts`) is not installed yet; it comes with step 36.
- npm skipped esbuild's install script; Vite and tsx work without it.

**What comes next**
- Part E design approval, then step 28, Login.

## 2026-11-15: GitHub Pages preview

- Added `.github/workflows/pages.yml`: on every push to `main` it runs the tests, builds the web app and publishes it to https://aswanth05.github.io/stockmarket_analysis/ (frontend only, labelled "Static preview").
- Needs a one-time setting: repo Settings → Pages → Source: GitHub Actions. The first deploy failed because Pages was not yet enabled.

## 2026-11-15: Step 30, Home screen with placeholder data (run before steps 28–29 at the user's request)

**What changed**
- App shell from UI_DESIGN §2: sidebar (collapses to icons on tablet), top bar with market status and live ET clock, "Sample data" badge, notifications and account buttons; phone layout uses one column and a bottom nav for the five main screens. Unbuilt screens show which step builds them. The component examples moved to their own sidebar link.
- Home screen from UI_DESIGN §3: four summary cards (SPY proxy, breadth, watchlist filings, watchlist count), index ETF proxy chart (SPY/DIA/QQQ selector, range tabs, 1H/1D disabled with the reason), sector donut, breadth gauge (share above 50-day average, our own measure), sortable top-markets table, daily candle chart with volume and 50/200-day averages, AI review box, weekly sector comparison, recent EDGAR filings, and a footer strip with only supportable claims.
- Charts are hand-built SVG with hover tooltips and arrow-key stepping. The categorical palette passed the dataviz validator against the card surface (CVD ΔE ≥ 8.4, contrast ≥ 3:1).
- `shared/src/market/session.ts`: market status from Eastern Time. **Provisional**: no holiday calendar yet (step 29), and pre/after-hours windows (4:00–9:30, 16:00–20:00) must be confirmed with the data provider.
- All numbers come from `web/src/screens/home/sampleData.ts`, fixed-seed sample data. A banner and every card say "Sample data".

**What was tested**
- 49 tests pass, adding: session status (weekend closed, each window, daylight time), Home has no buy/sell or crypto wording, every card shows a data time and source, ETF proxy label visible, disabled ranges explain why, missing price shows a dash not $0.00, moving average returns null until enough data.
- Typecheck and lint pass. Screenshots checked at 1440px (desktop) and 500px (phone layout).

**Open items**
- Steps 28 (Login) and 29 (holiday calendar) are still to do; the terminal is not behind a login yet.
- The moving-average calculation is in the frontend sample file for now; step 36 moves it to the server per CLAUDE.md.

**What comes next**
- Step 31, Data connection (needs Alpaca and EODHD keys in `server/.env`), or step 28, Login.

## 2026-11-15: Steps 28–44, full version 1 scope (built in one pass at the user's request)

**What changed**
- **28 Login:** sign-up, login, logout, password change. bcrypt (12 rounds), random session tokens stored hashed, httpOnly SameSite=Lax cookie, login rate limit (5 failures per email+IP, 20 attempts per IP, 15 min), same error for unknown email and wrong password. Sign-up closes after the first account unless `ALLOW_SIGNUP=true`. State-changing requests must carry the app's `X-Requested-With` header and a matching Origin. Every terminal endpoint requires login.
- **29 Market calendar:** `server/data/nyse-calendar.json` from nyse.com (holidays and early closes 2026–2028). Server computes open / pre-market / after-hours / closed in ET, names holidays, handles early closes.
- **31 Data connection:** one service per provider in `server/src/providers/` (Alpaca, EODHD, SEC EDGAR, Anthropic via its SDK). Keys read only in `config.ts`. Every provider call logged (path, status, timing, error; never keys).
- **32 Quote storage:** each quote stored with its own time, source and feed type. A failed refresh keeps the last value and marks it stale with the error; quotes older than 15 min past their delay during the session are stale too. Change % computed on the server.
- **33 Home on real data:** SPY proxy, breadth from the saved S&P 500 list, share above 50-day average (only when ≥90% of the list has history), sector counts, weekly sector returns, top markets, watchlist filings, latest AI review. Every card shows data time and source; empty states explain what to connect.
- **34 Watchlist:** stored per account on the server; add via search, remove, filter box; prices poll every 30 s.
- **35 Stock Research:** company header (exchange from EDGAR), Long Term tab (key figures with formula tooltips showing inputs, period, filing ID; revenue/net income chart; annual table where every number has its source; experimental factor scores with weights; rule-based risk flags; AI review panel; recent filings; sources), Swing Trading tab.
- **36 Daily chart:** candles, volume, 50/200-day averages calculated on the server; swing statistics with formulas.
- **37 Index proxies:** SPY, DIA, QQQ labelled "ETF proxy".
- **38 Sectors:** two separate areas: recent price movement (1D/1W/1M) and business outlook (median revenue growth and net margin from EDGAR frames).
- **39 Screener:** filter panel left, results right, removable active-filter chips; missing data never passes a filter.
- **40 EDGAR fundamentals:** annual 10-K values per fiscal-year end with accession number, filing date and XBRL tag; revenue growth, net margin, ROE (average equity), free cash flow in `server/src/calculations/` with versioned definitions (`definitions/v1.ts`).
- **41 Live updates:** polling (quotes job every minute in session; pages poll 30–60 s; freshness badges update; when the market is closed badges read "Closed · last trade").
- **42 AI review:** Claude Opus 5.5 with structured output and server-side refusal fallback; writes only from stored evidence; output with recommendation wording is withheld; monthly cap required and checked before each call; each review stores date, model, evidence date, sources and cost.
- **43 Accessibility and phone:** skip link, focus moves to content on navigation, labelled tables, chart text summaries, keyboard tooltips and combobox, reduced-motion rule, account menu for Settings/Sources on phones. All screens checked at 390 px with no sideways scrolling.
- **44 Deployment:** production server serves the built frontend with security headers; `render.yaml` (persistent disk for SQLite; keys as Render secrets).

**What was tested**
- 94 automated tests pass (shared 11, server 42, web 41), plus typecheck and lint. Server tests cover login gating, cookie flags, bcrypt storage, rate limit, cross-site rejection, watchlist persistence across logout and per-account privacy, stale marking, EDGAR extraction (quarters and 10-Q values excluded), the four calculations including zero and negative cases, a screener manual check, AI budget refusal, and that no key value appears in API responses.
- End to end on a separate test server and database: sign-up, watchlist, every API route, then screenshots of each screen at 1440 px and 390 px (with synthetic prices in the throwaway database only).
- Production mode: built app served, deep links work, logged-out API refused, headers present, test key values absent from the browser bundle.

**Not yet verified (needs your keys)**
- Real Alpaca and EODHD calls (step 31 "AAPL quote appears"), and one day's prices against a public source (step 36).
- One company's figures against its actual 10-K (step 40). The extraction is tested on a trimmed EDGAR-shaped file, not on a live download.
- A real Claude review (step 42).
- Hosting on Render (step 44) needs your account.

**Open items**
- `SEC_EDGAR_USER_AGENT` in `server/.env` must be filled in by you (a privacy safeguard stopped me writing your email there).
- Part E design approval was skipped; colors and layout are still provisional.
- Trademark check for "TradeVision" (step 26) not done; the app uses the name "US Stock Terminal".

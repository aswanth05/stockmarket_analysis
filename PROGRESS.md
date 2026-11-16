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

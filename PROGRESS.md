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

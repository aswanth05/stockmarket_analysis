# US Stock Terminal

A private, research-only terminal for NYSE and Nasdaq stocks. See [PROJECT_STEPS.md](PROJECT_STEPS.md) for the plan, [CLAUDE.md](CLAUDE.md) for technical rules, [UI_DESIGN.md](UI_DESIGN.md) for screen rules, and [PROGRESS.md](PROGRESS.md) for status.

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

Open http://localhost:5173. The web app forwards `/api` requests to the API server.

## Checks

```sh
npm test           # all tests (shared, server, web)
npm run typecheck
npm run lint
```

## Keys

Copy `.env.example` to `server/.env` and fill it in from your password manager. `server/.env` is git-ignored. Keys are read only by `server/src/config.ts` and never reach the browser.

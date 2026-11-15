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

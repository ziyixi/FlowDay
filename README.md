# FlowDay

A visual daily task flow planner with Todoist integration. Spiritual successor to HourStack — pull tasks from Todoist, arrange them into a sequential day plan, execute with built-in time tracking, and review your productivity.

## Quick Start

### Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The dev server wipes the SQLite database on each start for a clean slate.

### Docker

```bash
docker compose up -d
```

Or build and run manually:

```bash
docker build -t flowday .
docker run -p 3000:3000 -v flowday-data:/app/db flowday
```

Mount `/app/db` as a volume to persist your database across container restarts.

Pre-built images are available from GitHub Container Registry:

```bash
docker pull ghcr.io/<owner>/flowday:main
docker run -p 3000:3000 -v flowday-data:/app/db ghcr.io/<owner>/flowday:main
```

## Setup

1. Get a Todoist API token from [Settings > Integrations > Developer](https://todoist.com/app/settings/integrations/developer)
2. Click the gear icon in FlowDay's top bar and paste your token
3. Click "Sync Now" — your today + overdue tasks appear in the sidebar
4. Drag tasks into the day flow to start planning

## Features

- **Sequential day flow** — ordered task list, not a calendar grid. Decide what to do and in what order.
- **Quick add** — create local tasks without Todoist, with editable titles.
- **Todoist sync** — read-only integration. Syncs all tasks so rescheduled items reappear on their new date with history intact. FlowDay never modifies your Todoist data.
- **Time tracking** — segment-based count-up timer with pause/resume. Manual entries supported.
- **Pomodoro mode** — preset focus blocks (5m, 30m, 45m, 1h, 1h 30m, 2h) that auto-save when they hit zero and play a gentle completion chime.
- **Pop-out timer** — Document Picture-in-Picture window that floats above other apps with the active task, countdown, pause/resume + complete buttons, and a peek at what's next. Auto-opens when you start a pomodoro.
- **Auto-idle pause** — long-running timers automatically pause when you lock your screen or step away (≥10 min idle). Uses the precise `IdleDetector` API when permission is granted (one-time on-entry prompt), otherwise falls back to a Page Visibility heuristic.
- **Data export** — CSV/JSON export of time entries and flow history with date range picker.
- **Multi-day view** — 1, 3, or 5 day horizon for planning context.
- **Daily planning ritual** — guided "Start My Day" wizard with task rollover from yesterday.
- **Task notes** — per-task-per-day session log for capturing context while working.
- **Day capacity** — configurable work-hours budget with overcommitment warnings.
- **Analytics** — daily review, weekly review with heatmaps, estimation accuracy tracking.
- **Soft-delete** — tasks are never hard-deleted. Calendar-based trash browser with restore.
- **PWA** — installable progressive web app with offline support. All PWA assets (manifest, service worker, icons) live under `/pwa/*` so a single Cloudflare Access bypass policy can protect the rest of the app.

## Tech Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **SQLite** (better-sqlite3) — local-first, WAL mode
- **Drizzle ORM** — type-safe schema and queries
- **Zustand** — reactive cache layer (SQLite is source of truth)
- **shadcn/ui v4** + **Tailwind CSS v4** — UI components
- **@dnd-kit/react** — drag and drop
- **Vitest** — unit and integration tests
- **Playwright** — end-to-end UI tests (run in CI)

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (wipes DB) |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm run lint` | ESLint |
| `npm test` | Run all tests |
| `npm run test:unit` | Unit tests only |
| `npm run test:integration` | Integration tests only |
| `npm run test:ui` | Playwright UI tests (run in CI; can hang on some local setups) |
| `npm run test:watch` | Watch mode |

## Testing

Tests use a fresh SQLite database per test case (no mocks for DB layer).

- **Unit tests** (`__tests__/unit/`): utility functions, database query helpers, store logic
- **Integration tests** (`__tests__/integration/`): API route handlers end-to-end
- **UI tests** (`__tests__/ui/`): Playwright end-to-end specs against the production build, seeded via `/api/test/*` routes. The catalogue lives in [PRD/UI_TEST_PLAN.md](PRD/UI_TEST_PLAN.md) and a unit test enforces that every plan entry has a matching `[UI-NNN]` spec.

```bash
npm test
```

## CI/CD

GitHub Actions runs on push to `main` and pull requests:
1. **Lint** + **Unit Tests** + **Integration Tests** + **Build** (parallel)
2. **Docker image** built and pushed to GitHub Container Registry (on main push or release)

## Architecture

```
Todoist Cloud (read-only) → FlowDay API (Next.js routes) → SQLite → Zustand → React UI
```

See [PRD/PRD.md](PRD/PRD.md) for full architecture documentation.

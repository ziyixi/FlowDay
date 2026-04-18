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
- **Time tracking** — segment-based timer with pause/resume. Manual entries supported.
- **Data export** — CSV/JSON export of time entries and flow history with date range picker.
- **Multi-day view** — 1, 3, or 5 day horizon for planning context.
- **Daily planning ritual** — guided "Start My Day" wizard with task rollover from yesterday.
- **Task notes** — per-task-per-day session log for capturing context while working.
- **Day capacity** — configurable work-hours budget with overcommitment warnings.
- **Analytics** — daily review, weekly review with heatmaps, estimation accuracy tracking.
- **Soft-delete** — tasks are never hard-deleted. Calendar-based trash browser with restore.
- **PWA** — installable progressive web app with offline support via service worker.

## Tech Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **SQLite** (better-sqlite3) — local-first, WAL mode
- **Drizzle ORM** — type-safe schema and queries
- **Zustand** — reactive cache layer (SQLite is source of truth)
- **shadcn/ui v4** + **Tailwind CSS v4** — UI components
- **@dnd-kit/react** — drag and drop
- **Vitest** — unit and integration tests

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
| `npm run test:watch` | Watch mode |

## Testing

Tests use a fresh SQLite database per test case (no mocks for DB layer).

- **Unit tests** (`__tests__/unit/`): utility functions, database query helpers
- **Integration tests** (`__tests__/integration/`): API route handlers end-to-end

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

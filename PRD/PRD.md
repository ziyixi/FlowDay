# FlowDay — Product Requirements Document

**A visual daily task flow planner with Todoist integration**
*Spiritual successor to HourStack, rebuilt for the modern solo productivity stack*

---

## 1. Problem Statement

HourStack was acquired by ClickUp and discontinued as a standalone product. It left behind a gap for users who loved its core workflow: **pull tasks from Todoist → visually arrange them into a day plan → execute sequentially → track what actually happened**. No current tool replicates this well. Sunsama is close but costs $16/mo and overcomplicates things. What's needed is a lean, beautiful, open-source alternative you fully own.

### The Core Insight (What Made HourStack Special)

Most time-blocking apps force you to assign exact clock times to tasks. But knowledge work doesn't work that way — you don't know if the 2pm meeting will run long, or if you'll get into flow state on the morning coding task. **FlowDay embraces sequential ordering over clock-time scheduling.** You decide *what* to do today and *in what order*, then simply work through the list. The app tracks how long each task actually takes, building data over time.

---

## 2. Target User

Solo knowledge workers (developers, designers, writers, consultants) who already use Todoist as their task inbox and want a daily execution layer on top. Not teams — keep it personal and fast.

---

## 3. Core Concepts

| Concept | Description |
|---------|-------------|
| **Task Pool** | Sidebar showing Todoist tasks (today + overdue). This is your "available work" drawer. |
| **Day Flow** | The main canvas — an ordered list of tasks you've committed to today. Not time-slotted, just sequenced. |
| **Active Task** | The task you're currently working on. One at a time. Timer runs automatically. |
| **Time Entry** | A recorded span: which task, start time, end time, duration. Builds your history. |
| **Day View / Multi-Day View** | Toggle between focusing on today vs. seeing a 3-day or 5-day horizon. |

---

## 4. Feature Breakdown

### 4.1 — Todoist Sidebar (Task Pool) ✅ Implemented

**What it does:** Syncs with Todoist and shows tasks in a collapsible sidebar panel.

- Authenticate via Todoist personal API token (entered in Settings dialog)
- Display tasks grouped by: Arranged (current day's flow), Completed (current day's completed), Today, Overdue
- Each task card shows: title, priority color dot, project name, estimated duration (click-to-edit), description tooltip on hover
- Drag a task from the sidebar → drop into the Day Flow
- Tasks are *read-only* from Todoist — FlowDay never writes to the Todoist API
- Tasks can be soft-deleted (hidden) locally via a trash icon on each sidebar card; deleted tasks are never removed from DB and never sync back to Todoist
- Deleted tasks are browsable via a calendar-based trash dialog (trash icon in sidebar header), grouped by deletion date, with search and restore functionality
- Todoist sync never resurrects soft-deleted tasks
- Estimated duration is locally editable (click the estimate on any task card to change it; persisted to SQLite)
- Task description synced from Todoist; rendered as Markdown tooltip on hover in sidebar (via `react-markdown`)
- "Refresh" button (sidebar header) + auto-sync every 60 seconds
- Search/filter within the sidebar
- Only fetches tasks due today or overdue (via `GET /api/v1/tasks/filter?query=today | overdue`)
- **Arranged list:** Shows tasks added to the current day's flow (primary accent), non-draggable summary
- **Completed list:** Shows tasks completed in the current day's flow with logged time + estimated time

**Implementation notes:**
- Todoist API v1 (`/api/v1/tasks/filter`, `/api/v1/projects`) with cursor-based pagination
- Fetches task `content` (title) and `description` from Todoist API
- API key stored in SQLite `settings` table, entered via Settings dialog in top bar
- Tasks persisted in SQLite `tasks` table — survive page refresh
- `estimated_mins` editable locally via `PATCH /api/tasks` — Todoist sync preserves local edits only when Todoist has no duration set
- Zustand store (`todoist-store`) acts as reactive cache, hydrated from SQLite on load
- Color mapping: Todoist color names (e.g., `berry_red`) → hex values (20 colors supported)
- Task labels shown in hover tooltip alongside description

### 4.2 — Day Flow (Main Canvas) ✅ Implemented

**What it does:** An ordered, drag-reorderable list of tasks for the day.

- Drag to reorder tasks within the flow
- Each task card shows: title, project name, labels, estimated duration (click-to-edit via `EstimateEditor` popover), actual time (when timer runs), priority color dot
- Each card has action buttons: play/pause (timer), manual time entry (clock icon), complete (check), skip (move to bottom), remove (return to pool)
- The top card is visually highlighted as "Next" with a primary-color left border and badge
- Drag-sortable within the flow using unique sortable IDs (`date::taskId::sortableKey`) for dnd-kit stability
- Visual progress bar at the bottom: tasks completed vs. total, total estimated time vs. actual logged time
- Completed tasks shown in a dimmed section with undo button, showing both estimated and actual logged time

**Multi-day view (3-day, 5-day):**
- Horizontal columns for each day with compact read-only task cards
- Toggle via 1/3/5 buttons in top bar
- Date navigation with prev/next buttons and "Today" shortcut

**Persistence:**
- Flow assignments (task order per date) persisted in SQLite `flow_tasks` table
- Completed task assignments persisted in SQLite `completed_flow_tasks` table
- Write-through: Zustand updates optimistically, then fire-and-forget API call to persist
- `sortableGen` counter + `sortableKeys` map in flow store prevent stale dnd-kit state on re-add

### 4.3 — Time Tracking ✅ Implemented

**Segment-based timer:**
- Timer starts when you click play on a task, shows elapsed time on the card and in sidebar/top bar
- Pause saves the current running segment as a `time_entry` and stops the clock
- Resume starts a new segment — each pause/resume creates a separate time entry for accuracy
- Complete stops timer + saves + marks task complete in flow
- Only one task can have an active timer at a time; switching auto-saves the previous

**Manual time entry:**
- Clock icon on each flow task card opens a popover showing all time entries for that task
- Each entry shows: date, time range (HH:mm – HH:mm), duration, source (timer/manual)
- Add new entries via dialog with datetime-local inputs
- Edit existing entries via dialog
- Delete entries
- Entries display across all dates (not scoped to current day)

**Timer display locations:**
- Flow task card: shows live elapsed when active, cumulative logged time when inactive
- Top bar: `TimerDisplay` component with task name, elapsed, pause/complete buttons
- Sidebar: `SidebarTimer` with task name, elapsed, pause/play toggle

**Implementation notes:**
- Segment-based model: `segmentWallStart` (ISO) + `segmentStartedAt` (Date.now()) for wall-clock accuracy
- `setInterval` at 1Hz, module-level `intervalId` (not in Zustand — not serializable)
- Time entries stored in SQLite `time_entries` table via `/api/entries` routes
- `{ cache: "no-store" }` on all fetch calls to avoid Next.js response caching
- `entryRevision` counter in timer store bumped on segment saves, triggers UI refresh of time entry lists

### 4.4 — Day View / Multi-Day View ✅ Implemented

**Single Day View:**
- Full focus on today's flow. Larger task cards with all action buttons, prominent timer, "Next" indicator.

**Multi-Day View (3-day or 5-day):**
- Horizontal columns with day headers (day-of-week + date)
- Compact read-only task cards (no timer controls, no drag)
- Progress bar per column
- Past/future days visible for planning context

**Toggle:** 1/3/5 buttons in top bar center section. Date navigation with chevrons + "Today" button.

### 4.5 — Settings ✅ Implemented

- Settings dialog accessible from gear icon in top bar
- Todoist API key input (password field) with Save button
- "Sync Now" button with spinning indicator
- Last sync timestamp display
- Guidance text: where to find the API key, read-only assurance
- Daily work capacity setting (hours input, default 6h, stored as `day_capacity_mins` in SQLite settings)

### 4.6 — Roll-over & Day Capacity ✅ Implemented

**Roll-over:**
- On opening FlowDay for a new day, a prompt appears if yesterday has incomplete tasks: "You have N unfinished tasks from yesterday — roll over or dismiss?"
- "Roll over to today" button moves all incomplete tasks from yesterday to the top of today's flow (preserving order, deduped)
- Rolled-over tasks are removed from yesterday's flow
- Prompt is dismissable and doesn't re-appear once dismissed
- Roll-over prompt shown in both empty and non-empty day flow states

**Day Capacity Warning:**
- Configurable daily work-hours budget in Settings (default: 6h of focused work)
- Progress bar shows total estimated time vs. capacity (e.g., `~3h est / 6h cap`)
- When total estimates exceed capacity, amber warning: "You've planned ~8h 30m for a 6h day"
- Capacity stored reactively in flow store (`dayCapacityMins`) — updates instantly when saved in Settings
- Non-blocking — just an awareness nudge, not a hard limit

**Implementation notes:**
- `day_capacity_mins` stored in SQLite `settings` table, fetched during flow store hydration
- `PUT /api/flows` supports `rollover` action: moves incomplete tasks from `fromDate` to top of `toDate` flow
- `PUT /api/settings` accepts `day_capacity_mins` alongside `todoist_api_key`
- Flow store `dayCapacityMins` field + `setDayCapacityMins` action for reactive UI updates

### 4.7 — Daily Planning Ritual ("Start My Day") ✅ Implemented

**What it does:** A guided multi-step wizard when opening FlowDay each morning to set up the day's plan.

- Triggered automatically when today's flow is empty and planning not yet completed (waits for store hydration)
- Also available via "Plan My Day" button in the empty day-flow state (always visible for today)
- Dynamic step count based on whether yesterday has incomplete tasks:
  - Step 1 (conditional): Select roll-over candidates with checkboxes (all checked by default), "Roll Over N Tasks" or "Skip"
  - Step 2: Add tasks from Todoist pool — shows overdue + today tasks with "+" buttons, live task count in footer
  - Step 3: Review plan — numbered task list with inline estimate editors and remove buttons
  - Step 4: Confirm — capacity summary with progress bar, over-capacity warning, "Start My Day" button
- Dismissable at any step via "×" button — sets planning as completed to prevent re-triggering
- Roll-over in wizard is selective (per-task checkboxes) vs. the standalone rollover prompt which is all-or-nothing
- Rollover prompt is suppressed when planning is completed for the date
- Stores `planning_completed:<date>` flag in SQLite settings table, loaded during hydration

**Implementation notes:**
- New component: `planning-wizard.tsx` — 4 sub-components (StepRollover, StepAddTasks, StepReview, StepConfirm)
- `PUT /api/flows` supports `rolloverSelected` action: moves only specified task IDs from source to target
- `GET /api/settings` returns `planning_completed_today: boolean`
- `PUT /api/settings` accepts `planning_completed_date` to persist the flag
- Flow store additions: `hydrated: boolean`, `planningCompletedDates: Record<string, boolean>`, `setPlanningCompleted(date)`, `rolloverSelectedTasks(from, to, ids)`
- Auto-trigger uses `useRef` guard to evaluate once after hydration, preventing premature trigger on empty pre-hydration state

### 4.8 — Task Notes / Session Log 🔮 Future

**What it does:** Per-task-per-day text notes for capturing context while working.

- Small expandable text area on each flow task card (pencil/note icon to toggle)
- Jot notes during execution: "blocked on API response," "need to follow up with X," "found a related bug in auth module"
- Notes are scoped to `(task_id, flow_date)` — same task on different days gets separate notes
- Notes visible in the completed tasks section and in multi-day read-only view
- New DB table: `flow_task_notes (id, task_id, flow_date, content, updated_at)`
- Useful for daily review / weekly review: "what did I actually do and learn?"

### 4.9 — Analytics & Weekly Review Dashboard 🔮 Future

**Daily Review Panel (end of day):**
- Planned vs. actual time per task (bar chart comparison)
- Tasks completed vs. skipped vs. rolled over
- Total productive time

**Weekly Review (GTD-style reflection):**
- Accessible via a new tab/toggle in the top bar (e.g., a chart icon)
- Completion summary: tasks completed this week by project (grouped bar chart or list)
- Stuck work: tasks that appeared in flows on multiple days but weren't completed (rolled over repeatedly) — highlights planning vs. execution gaps
- Estimation accuracy: scatter plot or table of estimated vs. actual time per task, with overall accuracy percentage
- Time distribution: total tracked hours this week, broken down by Todoist project (donut chart)
- Week-over-week comparison of total productive hours and tasks completed

**Monthly Reports:**
- Estimation accuracy trend
- Productivity heatmap
- Average tasks completed per day

- Data sourced from existing `time_entries`, `flow_tasks`, and `completed_flow_tasks` tables — no new data collection needed

### 4.10 — Additional Features (Planned)

- **Quick Add:** Local tasks that don't come from Todoist
- **Export:** CSV/JSON export of time entries and flow history (planned vs. actual per day)
- **Todoist write-back:** Optionally mark tasks complete in Todoist when completed in FlowDay (requires careful safeguards)
- **Estimate presets:** The `EstimateEditor` component provides 30m, 45m, 1h, 1.5h, 2h, 2.5h, 3h presets plus custom minute input and clear

---

## 5. What FlowDay is NOT

- Not a full project management tool (Todoist handles that)
- Not a team collaboration tool (no shared views, no resource allocation)
- Not a calendar app (no clock-time slots, no meeting integration in v1)
- Not a Pomodoro app (continuous tracking, not intervals)

---

## 6. Tech Stack (Actual)

### Frontend

| Layer | Choice | Notes |
|-------|--------|-------|
| **Framework** | **Next.js 16.2.3 (App Router)** | Turbopack, file-based routing |
| **UI Library** | **shadcn/ui v4 + Tailwind CSS v4** | Uses `@base-ui/react` (NOT Radix) |
| **Drag & Drop** | **@dnd-kit/react 0.3.2** | `useDraggable`, `useSortable`, `useDroppable`, `DragDropProvider` |
| **State Management** | **Zustand v5** | Reactive cache layer; SQLite is source of truth |
| **Icons** | **Lucide React** | Clean, consistent icon set |
| **Date/Time** | **date-fns v4** | Tree-shakeable, functional API |
| **Markdown** | **react-markdown v10** | Renders task descriptions in tooltips |
| **Animations** | **tw-animate-css** | Tailwind animation utilities |
| **Variants** | **class-variance-authority** | Component variant utility (cva) |

### Backend & Data

| Layer | Choice | Notes |
|-------|--------|-------|
| **Database** | **SQLite via better-sqlite3** | Local-first, WAL mode, `globalThis` singleton for HMR |
| **ORM** | **Drizzle ORM** | Type-safe schema + queries |
| **API Layer** | **Next.js Route Handlers** | `/app/api/*` routes for all CRUD |
| **Auth (Todoist)** | **Personal API token** | Stored in SQLite settings table |

### Key Architecture Decisions

- **SQLite as source of truth**: Tasks, flows, time entries, settings all in SQLite. Zustand stores are reactive cache only.
- **Read-only Todoist**: FlowDay only reads from Todoist API, never writes. This prevents bugs from affecting real Todoist data.
- **Write-through persistence**: UI mutations update Zustand optimistically, then fire-and-forget API calls to persist to SQLite.
- **Segment-based timer**: Each pause saves a separate time entry for the actual running segment, ensuring accurate time tracking.
- **Dev-mode fresh DB**: `predev` script wipes SQLite on `npm run dev`; production persists.
- **`serverExternalPackages: ["better-sqlite3"]`** in next.config.ts for native addon support.

---

## 7. Project Structure (Actual)

```
flowday/
├── app/
│   ├── layout.tsx                 # Root layout, providers, theme
│   ├── page.tsx                   # Main app (single-page)
│   ├── globals.css                # Tailwind CSS v4 theme + global styles
│   └── api/
│       ├── entries/
│       │   ├── route.ts           # POST create, GET query time entries
│       │   └── [id]/route.ts      # PUT update, DELETE time entry
│       ├── flows/route.ts         # GET all flows, PUT flow mutations
│       ├── settings/route.ts      # GET/PUT Todoist API key
│       ├── sync/route.ts          # POST trigger Todoist sync
│       ├── tasks/route.ts         # GET all tasks, PATCH estimate, DELETE soft-delete
│       │   └── deleted/route.ts   # GET deleted tasks, POST restore
├── components/
│   ├── layout/
│   │   ├── app-shell.tsx          # DragDropProvider + sidebar + canvas
│   │   ├── top-bar.tsx            # Date nav, view toggle, timer, settings
│   │   └── sidebar.tsx            # Collapsible sidebar with timer + search + task pool
│   ├── todoist/
│   │   ├── task-pool.tsx          # Task sections (Arranged, Completed, Overdue, Today)
│   │   ├── task-card.tsx          # Draggable sidebar task card (with delete + tooltip)
│   │   ├── task-card-overlay.tsx  # Drag overlay appearance
│   │   └── deleted-tasks-dialog.tsx # Calendar-based trash browser
│   ├── flow/
│   │   ├── day-flow.tsx           # Editable + read-only day flow views
│   │   ├── flow-task-card.tsx     # Full task card with timer + actions
│   │   ├── progress-bar.tsx       # Day progress + capacity warning
│   │   ├── rollover-prompt.tsx    # Yesterday's incomplete tasks prompt
│   │   └── planning-wizard.tsx    # Daily planning ritual wizard
│   ├── timer/
│   │   ├── timer-display.tsx      # Top bar timer component
│   │   └── manual-entry.tsx       # Time entry popover + add/edit dialogs
│   ├── settings/
│   │   └── settings-dialog.tsx    # API key + capacity + sync settings dialog
│   ├── shared/
│   │   └── estimate-editor.tsx    # Reusable estimate popover (presets + custom)
│   ├── theme-provider.tsx
│   └── ui/                        # shadcn/ui components (base-ui/react, base-nova style)
│       ├── button.tsx
│       ├── dialog.tsx
│       ├── input.tsx
│       ├── label.tsx
│       ├── popover.tsx
│       ├── separator.tsx
│       ├── sheet.tsx
│       ├── toggle.tsx
│       └── tooltip.tsx
├── lib/
│   ├── todoist/
│   │   ├── api.ts                 # Todoist API client (read-only, paginated)
│   │   ├── colors.ts              # Todoist color name → hex mapping
│   │   └── sync.ts                # Sync orchestration: fetch → transform → upsert
│   ├── db/
│   │   ├── schema.ts              # Drizzle schema (5 tables)
│   │   ├── index.ts               # DB connection singleton
│   │   └── queries.ts             # All CRUD query helpers
│   ├── stores/
│   │   ├── flow-store.ts          # Zustand: flow assignments + write-through
│   │   ├── timer-store.ts         # Zustand: active timer state
│   │   └── todoist-store.ts       # Zustand: task cache + hydrate/sync
│   ├── hooks/
│   │   ├── use-hydration.ts       # Load tasks + flows from SQLite on mount
│   │   └── use-auto-sync.ts       # 1-minute Todoist sync interval
│   ├── types/
│   │   └── task.ts                # Task interface + priority config
│   ├── data/
│   │   └── mock-tasks.ts          # Legacy mock data (unused)
│   ├── utils/
│   │   └── time.ts                # formatDuration, formatElapsed
│   └── utils.ts                   # cn() utility
├── db/
│   └── flowday.db                 # SQLite database (gitignored)
├── .gitignore                     # Includes /db/, *.db, *.db-journal, *.db-wal
├── AGENTS.md                      # Agent rules for Next.js 16 breaking changes
├── CLAUDE.md                      # Claude AI coding instructions
├── README.md
├── next.config.ts
├── tsconfig.json
├── eslint.config.mjs
├── postcss.config.mjs
├── components.json                # shadcn/ui v4 config (base-nova style)
└── package.json
```

---

## 8. Database Schema (Actual)

```sql
-- Tasks: synced from Todoist, cached locally
CREATE TABLE tasks (
  id              TEXT PRIMARY KEY,     -- Todoist task ID
  todoist_id      TEXT,                 -- Same as id for synced tasks
  title           TEXT NOT NULL,
  description     TEXT,                 -- Todoist task description
  project_name    TEXT,
  project_color   TEXT,                 -- Hex color
  priority        INTEGER NOT NULL DEFAULT 1,
  labels          TEXT DEFAULT '[]',    -- JSON string[]
  estimated_mins  INTEGER,
  is_completed    INTEGER NOT NULL DEFAULT 0,
  completed_at    TEXT,
  due_date        TEXT,                 -- YYYY-MM-DD
  created_at      TEXT,
  synced_at       TEXT,                 -- Last sync timestamp
  deleted_at      TEXT                  -- Soft-delete timestamp (NULL = active)
);

-- Settings: key-value store (API keys, preferences)
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- Flow assignments: which tasks are planned for which day, in what order
CREATE TABLE flow_tasks (
  id         TEXT PRIMARY KEY,
  flow_date  TEXT NOT NULL,             -- YYYY-MM-DD
  task_id    TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  UNIQUE(flow_date, task_id)
);

-- Completed flow tasks: tasks marked complete within a day's flow
CREATE TABLE completed_flow_tasks (
  id        TEXT PRIMARY KEY,
  flow_date TEXT NOT NULL,
  task_id   TEXT NOT NULL,
  UNIQUE(flow_date, task_id)
);

-- Time entries: the core data FlowDay owns
CREATE TABLE time_entries (
  id          TEXT PRIMARY KEY,
  task_id     TEXT NOT NULL,
  flow_date   TEXT NOT NULL,
  start_time  TEXT NOT NULL,            -- ISO 8601
  end_time    TEXT,                     -- NULL if still running
  duration_s  INTEGER,                  -- Computed on stop
  source      TEXT NOT NULL DEFAULT 'timer',  -- 'timer' | 'manual'
  created_at  TEXT DEFAULT (datetime('now'))
);
```

---

## 9. Data Flow Architecture

```
┌─────────────────────────────────────────────────────┐
│                    TODOIST CLOUD                     │
│  (Source of truth for tasks — read-only access)      │
└─────────────┬───────────────────────────────────────┘
              │ GET /api/v1/tasks/filter?query=today|overdue
              │ GET /api/v1/projects
              ▼
┌─────────────────────────────────────────────────────┐
│              FLOWDAY API LAYER                      │
│  Next.js Route Handlers                             │
│  POST /api/sync → fetch Todoist + upsert SQLite     │
│  GET /api/tasks → read tasks from SQLite            │
│  GET/PUT /api/flows → read/write flow assignments   │
│  GET/PUT /api/settings → API key management         │
│  CRUD /api/entries → time entry management          │
└─────────────┬───────────────────────┬───────────────┘
              │                       │
              ▼                       ▲
┌─────────────────────────────────────────────────────┐
│           SQLite (source of truth)                   │
│  tasks, settings, flow_tasks, completed_flow_tasks, │
│  time_entries                                        │
└─────────────┬───────────────────────┬───────────────┘
              │                       │
              ▼                       ▲
┌─────────────────────────────────────────────────────┐
│          Zustand Stores (reactive cache)             │
│  todoist-store: tasks[], hydrate(), sync()           │
│  flow-store: flows{}, completedTasks{}, hydrate()    │
│  timer-store: activeTaskId, displaySeconds           │
└─────────────┬───────────────────────┬───────────────┘
              │                       │
              ▼                       ▲
┌─────────────────────────────────────────────────────┐
│               REACT UI                              │
│  Sidebar (task pool) ← Todoist tasks                │
│  Day Flow (canvas) ← flow assignments + timer       │
│  Timer display ← timer store                        │
│  Settings dialog ← settings API                     │
└─────────────────────────────────────────────────────┘
```

---

## 10. Build Sessions — Completed

### Session 1 — Scaffold ✅
- Next.js + Tailwind + shadcn/ui setup
- App shell layout (sidebar + main canvas + top bar)
- Dark mode with system/light/dark toggle
- Mock task data

### Session 2 — Task Pool ✅
- Collapsible sidebar with search
- Task cards grouped by Today, Overdue, by Project
- Draggable task cards (`@dnd-kit/react`)
- Drag overlay with tilted appearance

### Session 3 — Day Flow ✅
- Droppable day flow zone with sortable task cards
- "Next" badge on top task
- Complete, skip, remove actions
- Read-only multi-day view (3-day, 5-day)
- Progress bar (tasks done, time remaining)
- Date navigation + "Today" button

### Session 4 — Timer + SQLite Persistence ✅
- SQLite database with `time_entries` table
- Segment-based live timer (start/pause/resume)
- Timer display in top bar, sidebar, and flow cards
- Manual time entry CRUD (add/edit/delete via popover + dialogs)
- Dev-mode fresh DB via `predev` script

### Session 5 — Todoist Integration + Full Persistence ✅
- SQLite tables for tasks, settings, flow_tasks, completed_flow_tasks
- Todoist API client (read-only) with cursor-based pagination
- Only fetches today + overdue tasks
- Settings dialog for API key input
- Manual refresh button + 1-minute auto-sync
- Task and flow persistence across page refreshes
- Write-through from Zustand to SQLite on all flow mutations

### Session 6 — Editable Estimates, Descriptions, Sidebar Lists ✅
- Editable estimated duration: click-to-edit on sidebar task cards and flow task cards, persisted via `PATCH /api/tasks`
- Task description: synced from Todoist API, shown as hover tooltip on sidebar task cards
- Completed task rows in day flow now show both estimated time and actual logged time
- Sidebar "Arranged" list: shows tasks added to the current day's flow (primary accent)
- Sidebar "Completed" list: shows completed tasks with logged time and estimate
- Database migration: added `description` column to tasks table
- Bug fixes: fixed `better-sqlite3` transaction invocation (must call returned function), timezone-aware overdue comparison

### Session 7 — Soft-Delete & Task Retention ✅
- Todoist sync no longer deletes local tasks when they disappear from the API (date changed, completed, deleted in Todoist)
- Soft-delete: trash icon on sidebar task cards marks tasks with `deleted_at` timestamp (never hard-deleted)
- Soft-deleted tasks hidden from all active views (sidebar pool, flows)
- Todoist sync preserves soft-delete status — syncing never resurrects deleted tasks
- Calendar-based deleted tasks browser: trash icon in sidebar header opens a dialog with monthly calendar view, dot indicators on dates with deleted tasks, search across all deleted tasks, and one-click restore
- Deleting a task in a flow automatically removes it from the flow and stops any active timer
- Database migration: added `deleted_at` column to tasks table
- New API endpoints: `DELETE /api/tasks` (soft-delete), `GET /api/tasks/deleted` (list), `POST /api/tasks/deleted` (restore)

### Session 8 — Roll-over & Day Capacity ✅
- Roll-over prompt: shown when yesterday has incomplete tasks, with "Roll over to today" and "Dismiss" buttons
- Roll-over moves incomplete tasks from yesterday to top of today's flow (deduped), removes from source
- `PUT /api/flows` `rollover` action handles server-side logic
- Day capacity: configurable hours in Settings dialog (default 6h), stored as `day_capacity_mins`
- Progress bar shows capacity (`/ 6h cap`) and amber warning when overcommitted
- Capacity stored reactively in flow store `dayCapacityMins` — updates instantly on save without page refresh
- `PUT /api/settings` extended to accept `day_capacity_mins` alongside API key
- New component: `rollover-prompt.tsx`

### Session 9 — Daily Planning Ritual ✅
- "Start My Day" multi-step wizard: selective roll-over → add tasks → review estimates → capacity check → confirm
- Auto-triggered when today's flow is empty and planning not completed; also available via "Plan My Day" button
- Dynamic step count: 3 steps (no rollover needed) or 4 steps (rollover candidates present)
- Per-date `planning_completed:<date>` flag stored in SQLite settings table
- `PUT /api/flows` `rolloverSelected` action for selective task rollover
- Flow store `hydrated` flag ensures wizard doesn't trigger before data loads
- Rollover prompt suppressed when planning completed for the date
- New component: `planning-wizard.tsx`

### Session 10 — Task Notes & Session Log 🔮 Future
- Per-task-per-day text notes on flow cards
- Expandable text area with pencil icon toggle
- Notes visible in completed section and multi-day view
- New `flow_task_notes` table

### Session 11 — Analytics & Weekly Review Dashboard 🔮 Future
- Daily review panel with planned vs. actual time
- Tasks completed vs. skipped vs. rolled over
- Weekly review: completion by project, stuck work detection, estimation accuracy
- Time distribution by project (donut chart)
- Week-over-week trends
- Productivity heatmap, monthly reports

---

## 11. Key Design Principles

1. **Sequential, not scheduled.** The day flow is an ordered list, not a calendar grid. This is the core differentiator.

2. **Todoist is the inbox, FlowDay is the workbench.** Don't rebuild task management. Let Todoist handle projects, priorities, recurring tasks. FlowDay just answers: "What am I doing today, and in what order?"

3. **Passive tracking.** The timer should be so frictionless that you forget it's running. Start on activate, stop on complete. That's it.

4. **Data compounds.** Every day you use FlowDay, your analytics get smarter. After a month, you'll know exactly how long "a code review" takes you.

5. **Read-only safety.** FlowDay never modifies Todoist data. This prevents bugs from corrupting the user's real task list.

6. **Local-first persistence.** SQLite is the source of truth. Zustand stores are reactive cache. Todoist is an upstream data source, not a dependency — the app works offline with cached data.

---

## 12. UI Layout

```
┌──────────────────────────────────────────────────────────────┐
│  FlowDay          [← Today, Apr 12 →]  [1][3][5]   ⏱  🌙 ⚙ │
├────────────────┬─────────────────────────────────────────────┤
│  Todoist       │                                             │
│  [🔄] [▢×]    │  Your day flow will appear here             │
│                │  Drag tasks from the sidebar to start       │
│  ┌──────────┐  │  planning your day                         │
│  │ 🔴 Task  │  │                                             │
│  │ Project   │  │  ─── or when tasks are added: ───          │
│  └──────────┘  │                                             │
│  ┌──────────┐  │  ┌─────────────────────────────────────┐   │
│  │ 🟡 Task  │──┼─▶│ NEXT  Design login page              │   │
│  │ Project   │  │  │ 30m est  5:23  ▶ 🕐 ✓ ⏬ ×         │   │
│  └──────────┘  │  └─────────────────────────────────────┘   │
│                │  ┌─────────────────────────────────────┐   │
│  🔍 Search...  │  │ Write API docs                        │   │
│                │  │ 45m est  —     ▶ 🕐 ✓ ⏬ ×           │   │
│  ♦ Active:     │  └─────────────────────────────────────┘   │
│  Task  5:23    │                                             │
│  ⏸             │  Completed (1)                              │
│                │  ┌─ ̶R̶e̶v̶i̶e̶w̶ ̶P̶R̶ ↩ ─────────────────────┐   │
│  ▼ Today (3)   │                                             │
│  ▼ Overdue (2) │  ━━━━━━━━━━━━━━ 1/3 · 5m · ~75m left ━━━  │
│  ▼ Work (5)    │                                             │
└────────────────┴─────────────────────────────────────────────┘
```

---

*Last updated: April 13, 2026*
*Version: 0.9 — Post-Session 9 (daily planning wizard, selective rollover, hydration guard)*

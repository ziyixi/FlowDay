# UI Test Plan

This document maps each Playwright UI case to the product area it protects.

## How To Read This

- `Case ID`: Stable ID that must match the Playwright test title.
- `Seed`: Test fixture loaded before the scenario starts.
- `Viewport`: `desktop` unless the case specifically targets portrait/mobile behavior.
- `What It Proves`: The main behavior or regression boundary the test is responsible for.

## Wizard And Day Planning

| Case ID | Scenario | Seed | Viewport | What It Proves | Spec |
| --- | --- | --- | --- | --- | --- |
| UI-001 | App shell renders on a clean day | `shell-empty` | desktop | The base shell loads with top bar, sidebar, and empty day-flow state. | `wizard.spec.ts` |
| UI-002 | Start Your Day wizard stays open after first add | `wizard-today-tasks` | desktop | The wizard does not close after the first add action. | `wizard.spec.ts` |
| UI-003 | Start Your Day completes and persists the plan | `wizard-today-tasks` | desktop | A full wizard flow creates the day plan and survives reload. | `wizard.spec.ts` |
| UI-017 | Wizard add-all button bulk-adds available tasks | `wizard-today-tasks` | desktop | The add-all shortcut adds every available task once and then disappears. | `wizard.spec.ts` |
| UI-022 | Start Your Day does not auto-roll yesterday into today | `wizard-with-yesterday-incomplete` | desktop | FlowDay no longer carries unfinished work forward unless Todoist itself is updated. | `wizard.spec.ts` |
| UI-012 | Portrait wizard and flow-card usability regression | `wizard-today-tasks` | portrait | The wizard and resulting flow cards remain readable and tappable on portrait/mobile layout. | `wizard.spec.ts` |

## Flow And Sidebar

| Case ID | Scenario | Seed | Viewport | What It Proves | Spec |
| --- | --- | --- | --- | --- | --- |
| UI-004 | Quick add, search, and drag into today flow | `shell-empty` | desktop | Local task creation, sidebar search, and drag-and-drop into an empty flow all work together. | `flow-and-shell.spec.ts` |
| UI-005 | Flow card edits persist | `single-flow-task` | desktop | Local title edits, estimate edits, and notes persist through reload. | `flow-and-shell.spec.ts` |
| UI-009 | Task lifecycle actions update flow and sidebar state | `two-flow-tasks` | desktop | Skip, complete, undo-complete, and return-to-pool all update the right surfaces. | `flow-and-shell.spec.ts` |
| UI-010 | Deleted-task restore returns a local task to the pool | `shell-empty` | desktop | Soft-deleted local tasks appear in trash and can be restored correctly. | `flow-and-shell.spec.ts` |
| UI-016 | Todoist-deleted tasks disappear from the sidebar | `todoist-overdue` | desktop | Todoist sync deletions are hidden from the pool without polluting the local trash dialog. | `flow-and-shell.spec.ts` |
| UI-023 | Future task pool follows the selected planning date | `future-dated-pool` | desktop | Planning for +2 and +3 days uses the selected flow date, not only today/tomorrow. | `flow-and-shell.spec.ts` |
| UI-027 | Repeated date-nav clicks keep the next/previous hit target stable | `future-dated-pool` | desktop | Leaving today does not shift the arrow button under the cursor onto `Today`, so same-position repeated clicks continue navigating forward/backward. | `flow-and-shell.spec.ts` |
| UI-033 | Custom estimate input commits when the popover closes | `single-flow-task` | desktop | Typing a custom estimate and clicking outside the popover persists the value — no need to press Enter to avoid losing the edit. | `flow-and-shell.spec.ts` |

## Timer And Pomodoro

| Case ID | Scenario | Seed | Viewport | What It Proves | Spec |
| --- | --- | --- | --- | --- | --- |
| UI-006 | Count-up timer records entries and updates totals | `single-flow-task` | desktop | Start, pause, resume, and complete all persist tracked time correctly. | `timer.spec.ts` |
| UI-007 | Pomodoro preset auto-saves and clears active timer | `single-flow-task` | desktop | A pomodoro saves its time at zero and returns the UI to idle state. | `timer.spec.ts` |
| UI-008 | Manual entry CRUD updates time surfaces | `single-flow-task` | desktop | Manual time entries can be created, edited, and deleted through the UI. | `timer.spec.ts` |
| UI-013 | Pop-out timer button toggles with timer activity | `single-flow-task` | desktop | The PiP entry point appears only when timer activity exists. | `timer.spec.ts` |
| UI-014 | Pomodoro completion fires a single chime | `single-flow-task` | desktop | Pomodoro completion chimes once, and count-up timers do not chime. | `timer.spec.ts` |
| UI-015 | Auto-idle pause backdates the segment | `single-flow-task` | desktop | Away time is excluded when auto-idle pause triggers. | `timer.spec.ts` |
| UI-018 | Task estimate is offered as the first Pomodoro preset | `single-flow-task` | desktop | Task estimate becomes the suggested first pomodoro preset and deduplicates base presets. | `timer.spec.ts` |
| UI-019 | Pomodoro completion surfaces a finished marker for the pop-out | `single-flow-task` | desktop | The finished-task marker drives the pop-out restart/complete state and clears on next action. | `timer.spec.ts` |
| UI-020 | Reload restores a running pomodoro | `single-flow-task` | desktop | A server-backed timer session survives page reload and rehydrates correctly. | `timer.spec.ts` |
| UI-021 | Active pomodoro card still shows cumulative logged time | `single-flow-task-with-history` | desktop | The flow card keeps previously logged time visible while adding current pomodoro elapsed time. | `timer.spec.ts` |
| UI-025 | Manual entry defaults to the nearest 30-minute block | `single-flow-task` | desktop | The add-manual-entry dialog now defaults start and end to the nearest 30-minute block instead of hard-coding 9:00. | `timer.spec.ts` |
| UI-026 | Manual entry still supports exact minute edits | `single-flow-task` | desktop | Manual entry add/edit still supports arbitrary minute values like `09:13` and `10:17`, not only `:00` or `:30`. | `timer.spec.ts` |
| UI-028 | Misc count-up tracking stays outside the normal task UI | `single-flow-task` | desktop | Starting misc time from the top bar saves a real timer entry without creating a visible pool card or flow card. | `timer.spec.ts` |
| UI-029 | Misc pomodoro ends in a restart-or-done state | `single-flow-task` | desktop | A misc pomodoro auto-saves, keeps its finished marker, and offers `Done` instead of task completion. | `timer.spec.ts` |
| UI-031 | Suggested pomodoro subtracts already-logged time | `single-flow-task-with-history` | desktop | The first/suggested pomodoro preset reflects `estimate − already-logged` so repeated rounds don't re-offer the full estimate. | `timer.spec.ts` |
| UI-032 | Custom pomodoro input launches arbitrary minutes | `single-flow-task` | desktop | The picker accepts a free-form custom minute value and starts the pomodoro at that target. | `timer.spec.ts` |

## Settings, Analytics, And Export

| Case ID | Scenario | Seed | Viewport | What It Proves | Spec |
| --- | --- | --- | --- | --- | --- |
| UI-011 | Settings, export, and analytics smoke | `analytics-seeded` | desktop | Core settings, export dialog, and analytics tabs are all reachable and functional. | `flow-and-shell.spec.ts` |
| UI-024 | Analytics stats use browser local timezone | `analytics-timezone-boundary` | desktop | Analytics requests include browser timezone and render a near-midnight UTC session in the correct local bucket. | `flow-and-shell.spec.ts` |
| UI-030 | Analytics review tabs include misc tracked time | `analytics-seeded-with-misc` | desktop | Misc sentinel entries appear in Daily Review task breakdown and Weekly Review project summaries, not only in Work Patterns. | `flow-and-shell.spec.ts` |

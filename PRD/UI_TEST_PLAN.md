# UI Test Plan

| Case ID | Name | Viewport | Seed | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| UI-001 | App shell renders on a clean day | desktop | `shell-empty` | active | Top bar, sidebar, and empty flow state visible with planning already completed for today. |
| UI-002 | Start Your Day wizard stays open after first add | desktop | `wizard-today-tasks` | active | Regression guard for first `+` click on the add step. |
| UI-003 | Start Your Day wizard full flow persists plan | desktop | `wizard-today-tasks` | active | Add tasks, review, confirm, and verify resulting flow after reload. |
| UI-004 | Quick add, search, and drag into today flow | desktop | `shell-empty` | active | Covers local task creation and DnD into empty flow. |
| UI-005 | Flow card edit behaviors persist | desktop | `single-flow-task` | active | Edit local title, estimate, and notes, then verify after reload. |
| UI-006 | Count-up timer records entries and updates totals | desktop | `single-flow-task` | active | Start, pause, resume, complete, and verify logged time surfaces. |
| UI-007 | Pomodoro preset auto-saves and clears active timer | desktop | `single-flow-task` | active | Starts from preset, reaches zero, saves entry, and counts toward totals. |
| UI-008 | Manual entry CRUD updates time surfaces | desktop | `single-flow-task` | active | Create, edit, and delete a manual entry from the popover/dialog flow. |
| UI-009 | Task lifecycle actions update flow and sidebar state | desktop | `two-flow-tasks` | active | Skip, complete, undo complete, and return-to-pool. |
| UI-010 | Deleted-task restore returns task to active pool | desktop | `shell-empty` | active | Local task delete plus deleted-task dialog restore path. |
| UI-011 | Settings, export, and analytics smoke | desktop | `analytics-seeded` | active | Update capacity, verify warning, open analytics tabs, and trigger export. |
| UI-012 | Portrait wizard and flow-card usability regression | portrait | `wizard-today-tasks` | active | Verifies wizard flow and portrait-specific readability/tap-target behavior. |
| UI-013 | Pop-out timer button toggles with timer activity | desktop | `single-flow-task` | active | Pop-out entry point appears only while a timer is active and disappears when the task is completed. |
| UI-014 | Pomodoro completion fires a single chime | desktop | `single-flow-task` | active | Verifies the gentle completion chime fires exactly once when a pomodoro reaches zero and never for count-up timers. |
| UI-015 | Auto-idle pause backdates the segment | desktop | `single-flow-task` | active | Verifies that when the auto-idle hook detects the user was away, the resulting pause backdates the segment and the away period is not logged. |
| UI-016 | Todoist-deleted tasks disappear from sidebar | desktop | `todoist-overdue` | active | Verifies that tasks removed from Todoist (simulated orphan sweep) are hidden from the overdue/today pool on the next sync, while other Todoist tasks are unaffected and the deleted task does NOT surface in the trash dialog (that dialog is reserved for FlowDay-local deletes only). |
| UI-017 | Wizard add-all button bulk-adds today's tasks | desktop | `wizard-today-tasks` | active | Verifies the add-all shortcut adds every available pool task in one click, hides itself once everything is added, and the resulting plan persists through Review → Start My Day. |
| UI-018 | Task estimate is offered as the first Pomodoro preset | desktop | `single-flow-task` | active | Verifies a task's estimate is surfaced as the first (highlighted, suggested) preset in the Pomodoro picker and deduplicates against the base list when it matches. |
| UI-019 | Pomodoro completion surfaces a finished marker for the pop-out | desktop | `single-flow-task` | active | Verifies that when a pomodoro reaches zero the store captures the finished task so the pop-out can render a restart/complete panel, and that the marker is cleared by starting a new timer. |

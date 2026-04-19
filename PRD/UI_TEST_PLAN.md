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

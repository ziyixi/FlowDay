import { test, expect } from "@playwright/test";
import {
  completedRow,
  flowCard,
  TODAY,
  getChimeCount,
  getTimerState,
  openApp,
  resetAppState,
  resetChimeCount,
  setRunningTimerElapsed,
  seedAppState,
  simulateIdleAway,
} from "./helpers/e2e";

test.beforeEach(async ({ request }) => {
  await resetAppState(request);
});

test("[UI-006] Count-up timer records entries and updates totals", async ({
  page,
  request,
}) => {
  await seedAppState(request, "single-flow-task");
  await openApp(page);

  const card = flowCard(page, "Deep work block");

  await card.getByRole("button", { name: "Start timer" }).click();
  await expect(card.getByRole("button", { name: "Pause timer" })).toBeVisible();
  await setRunningTimerElapsed(page, 90);
  await card.getByRole("button", { name: "Pause timer" }).click();

  await expect(card.getByText("1:30", { exact: true })).toBeVisible();

  await card.getByTitle("Time entries").click();
  await expect(page.getByText(/Total: 2m/)).toBeVisible();
  await expect(page.getByText(/\(2m\)/)).toBeVisible();

  await card.getByTitle("Time entries").press("Escape");
  await card.getByRole("button", { name: "Resume timer" }).click();
  await setRunningTimerElapsed(page, 30);
  await card.getByRole("button", { name: "Complete task" }).click();

  await expect(completedRow(page, "Deep work block")).toBeVisible();
  await expect(page.getByText("1/1 tasks")).toBeVisible();
  await expect(completedRow(page, "Deep work block").getByText("2:00")).toBeVisible();
});

test("[UI-007] Pomodoro auto-saves and clears active timer state", async ({
  page,
  request,
}) => {
  await seedAppState(request, "single-flow-task");
  await openApp(page);

  const card = flowCard(page, "Deep work block");
  await card.getByTitle("Start Pomodoro").click();
  await page.getByRole("button", { name: "30m", exact: true }).click();

  await expect(page.getByRole("banner").getByText("Pomodoro 30m")).toBeVisible();
  await setRunningTimerElapsed(page, 30 * 60);
  await expect.poll(async () => (await getTimerState(page))?.activeTaskId ?? null).toBeNull();

  await expect(page.getByText("Pomodoro 30m")).toHaveCount(0);
  await expect(page.getByText("30:00 logged")).toBeVisible();

  await card.getByTitle("Time entries").click();
  await expect(page.getByText(/Total: 30m/)).toBeVisible();
  await expect(page.getByText(/\(30m\)/)).toBeVisible();
});

test("[UI-013] Pop-out timer button toggles with timer activity", async ({
  page,
  request,
}) => {
  await seedAppState(request, "single-flow-task");
  await openApp(page);

  const popOutButton = page.getByRole("button", { name: "Pop out timer" });

  // Idle: the button must not be present at all.
  await expect(popOutButton).toHaveCount(0);

  const card = flowCard(page, "Deep work block");
  await card.getByRole("button", { name: "Start timer" }).click();
  await expect(card.getByRole("button", { name: "Pause timer" })).toBeVisible();

  // Active timer: the pop-out entry point appears in the top bar.
  await expect(popOutButton).toBeVisible();

  await card.getByRole("button", { name: "Pause timer" }).click();
  // Paused still counts as an active session — button must remain available.
  await expect(popOutButton).toBeVisible();

  await card.getByRole("button", { name: "Resume timer" }).click();
  await card.getByRole("button", { name: "Complete task" }).click();
  await expect(completedRow(page, "Deep work block")).toBeVisible();

  // Back to idle: button must be removed again so it doesn't act on a stale task.
  await expect(popOutButton).toHaveCount(0);
});

test("[UI-014] Pomodoro completion fires a single chime", async ({
  page,
  request,
}) => {
  await seedAppState(request, "single-flow-task");
  await openApp(page);

  await resetChimeCount(page);
  expect(await getChimeCount(page)).toBe(0);

  const card = flowCard(page, "Deep work block");
  await card.getByTitle("Start Pomodoro").click();
  await page.getByRole("button", { name: "30m", exact: true }).click();

  await expect(page.getByRole("banner").getByText("Pomodoro 30m")).toBeVisible();

  // Drive the timer to its target so the completion path runs naturally.
  await setRunningTimerElapsed(page, 30 * 60);
  await expect
    .poll(async () => (await getTimerState(page))?.activeTaskId ?? null)
    .toBeNull();

  // Chime must fire exactly once for a completed pomodoro — never zero, never twice.
  expect(await getChimeCount(page)).toBe(1);

  // Starting and stopping a count-up timer must not produce additional chimes.
  await card.getByRole("button", { name: "Start timer" }).click();
  await expect(card.getByRole("button", { name: "Pause timer" })).toBeVisible();
  await setRunningTimerElapsed(page, 30);
  await card.getByRole("button", { name: "Pause timer" }).click();
  expect(await getChimeCount(page)).toBe(1);
});

test("[UI-018] Task estimate is offered as the first Pomodoro preset", async ({
  page,
  request,
}) => {
  // single-flow-task seeds the card with estimatedMins=45.
  await seedAppState(request, "single-flow-task");
  await openApp(page);

  const card = flowCard(page, "Deep work block");
  await card.getByTitle("Start Pomodoro").click();

  const presets = page.locator('[data-testid="pomodoro-preset"]');
  await expect(presets.first()).toHaveAttribute("data-suggested", "true");
  await expect(presets.first()).toHaveText("45m");

  // No duplicate preset — the base 45m entry should be filtered out in favor
  // of the suggested one so the grid stays at 6 buttons.
  await expect(presets).toHaveCount(6);
  await expect(presets.filter({ hasText: /^45m$/ })).toHaveCount(1);

  // The suggested preset must still be functional — clicking it launches a
  // 45-minute pomodoro like any other preset.
  await presets.first().click();
  await expect(page.getByRole("banner").getByText("Pomodoro 45m")).toBeVisible();
});

test("[UI-019] Pomodoro completion surfaces a finished marker for the pop-out", async ({
  page,
  request,
}) => {
  await seedAppState(request, "single-flow-task");
  await openApp(page);

  const card = flowCard(page, "Deep work block");
  await card.getByTitle("Start Pomodoro").click();
  await page.getByRole("button", { name: "30m", exact: true }).click();
  await expect(page.getByRole("banner").getByText("Pomodoro 30m")).toBeVisible();

  await setRunningTimerElapsed(page, 30 * 60);

  // Active timer wound down, but the finished marker must capture the task so
  // the pop-out panel can offer restart/complete instead of a bare idle view.
  await expect
    .poll(async () => (await getTimerState(page))?.pomodoroFinishedTaskId ?? null)
    .toBe("flow-task-1");
  await expect
    .poll(async () => (await getTimerState(page))?.activeTaskId ?? null)
    .toBeNull();

  // Starting a fresh count-up timer must clear the finished marker so the
  // panel doesn't linger stale.
  await card.getByRole("button", { name: "Start timer" }).click();
  await expect(card.getByRole("button", { name: "Pause timer" })).toBeVisible();
  await expect
    .poll(async () => (await getTimerState(page))?.pomodoroFinishedTaskId ?? null)
    .toBeNull();
});

test("[UI-015] Auto-idle pause backdates the segment to drop the away period", async ({
  page,
  request,
}) => {
  await seedAppState(request, "single-flow-task");
  await openApp(page);

  const card = flowCard(page, "Deep work block");
  await card.getByRole("button", { name: "Start timer" }).click();
  await expect(card.getByRole("button", { name: "Pause timer" })).toBeVisible();

  // Pretend the timer has been running for 5 minutes total in real time…
  await setRunningTimerElapsed(page, 300);
  // …but the user actually walked away 2 minutes ago. Backdating to that
  // moment should keep only the first 3 minutes of work and drop the rest.
  await simulateIdleAway(page, 120);

  await expect
    .poll(async () => (await getTimerState(page))?.status)
    .toBe("paused");

  // Card displays only the work that happened before the user went idle.
  await expect(card.getByText("3:00", { exact: true })).toBeVisible();

  // Persisted entry total reflects the same — 3m, NOT 5m.
  await card.getByTitle("Time entries").click();
  await expect(page.getByText("Total: 3m", { exact: true })).toBeVisible();
  await expect(page.getByText("Total: 5m", { exact: true })).toHaveCount(0);
});

test("[UI-008] Manual entry CRUD updates time entry surfaces", async ({
  page,
  request,
}) => {
  await seedAppState(request, "single-flow-task");
  await openApp(page);

  const card = flowCard(page, "Deep work block");
  await card.getByTitle("Time entries").click();
  await page.getByRole("button", { name: "Add time entry" }).click();

  const addDialog = page.getByRole("dialog", { name: "Add Time Entry" });
  await addDialog.locator('input[type="datetime-local"]').nth(0).fill(`${TODAY}T09:00`);
  await addDialog.locator('input[type="datetime-local"]').nth(1).fill(`${TODAY}T10:00`);
  await addDialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("dialog", { name: "Add Time Entry" })).toHaveCount(0);

  await card.getByTitle("Time entries").click();
  await expect(page.getByText(/Total: 1h/)).toBeVisible();

  const firstEntry = page
    .locator('[data-testid="time-entry-row"]')
    .filter({ has: page.getByText("09:00 – 10:00") })
    .first();
  await firstEntry.getByRole("button", { name: "Edit time entry" }).click({ force: true });

  const editDialog = page.getByRole("dialog", { name: "Edit Time Entry" });
  await editDialog.locator('input[type="datetime-local"]').nth(1).fill(`${TODAY}T10:30`);
  await editDialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("dialog", { name: "Edit Time Entry" })).toHaveCount(0);

  await card.getByTitle("Time entries").click();
  await expect(page.getByText(/Total: 1h 30m/)).toBeVisible();

  const updatedEntry = page
    .locator('[data-testid="time-entry-row"]')
    .filter({ has: page.getByText("09:00 – 10:30") })
    .first();
  await updatedEntry.getByRole("button", { name: "Delete time entry" }).click({ force: true });

  await card.getByTitle("Time entries").click();
  await expect(page.getByText("No entries yet")).toBeVisible();
});

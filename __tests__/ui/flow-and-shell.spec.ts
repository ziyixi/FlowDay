import { test, expect } from "@playwright/test";
import {
  completedRow,
  dragTaskToEmptyFlow,
  flowCard,
  flowCardById,
  openApp,
  resetAppState,
  seedAppState,
  simulateTodoistOrphanSweep,
  taskPoolCard,
} from "./helpers/e2e";

test.beforeEach(async ({ request }) => {
  await resetAppState(request);
});

test("[UI-004] Quick add, search, and drag a local task into today flow", async ({
  page,
  request,
}) => {
  await seedAppState(request, "shell-empty");
  await openApp(page);

  await page.getByTestId("quick-add-input").fill("Write docs");
  await page.getByTestId("quick-add-submit").click();

  await page.getByPlaceholder("Search tasks...").fill("docs");
  await expect(taskPoolCard(page, "Write docs")).toBeVisible();

  await dragTaskToEmptyFlow(page, "Write docs");

  await expect(flowCard(page, "Write docs")).toBeVisible();
});

test("[UI-005] Flow card title, estimate, and note edits persist across reload", async ({
  page,
  request,
}) => {
  await seedAppState(request, "single-flow-task");
  await openApp(page);

  const card = flowCardById(page, "flow-task-1");
  await card.hover();
  await card.getByTestId("edit-local-title").click();
  await card.getByTestId("edit-local-title-input").fill("Deep work session");
  await card.getByTestId("edit-local-title-input").press("Enter");

  await card.getByText("45m est").click();
  await page.getByRole("button", { name: "1h" }).click();

  await card.getByRole("button", { name: "Toggle notes" }).click();
  await card.getByRole("textbox").fill("Remember edge cases");
  await page.waitForTimeout(700);

  await page.reload();

  await expect(flowCard(page, "Deep work session")).toBeVisible();
  await expect(flowCard(page, "Deep work session").getByRole("button", { name: "1h est" })).toBeVisible();
  await expect(page.getByText("Remember edge cases")).toBeVisible();
});

test("[UI-009] Skip, complete, undo, and return-to-pool update flow state", async ({
  page,
  request,
}) => {
  await seedAppState(request, "two-flow-tasks");
  await openApp(page);

  await expect(flowCardById(page, "flow-task-a")).toBeVisible();

  const initialOrder = await page
    .locator('[data-testid="flow-task-card"]')
    .evaluateAll((cards) =>
      cards.map((card) => card.getAttribute("data-task-id"))
    );
  expect(initialOrder).toEqual(["flow-task-a", "flow-task-b"]);

  await flowCard(page, "Inbox zero").getByRole("button", { name: "Skip task" }).click();

  const skippedOrder = await page
    .locator('[data-testid="flow-task-card"]')
    .evaluateAll((cards) =>
      cards.map((card) => card.getAttribute("data-task-id"))
    );
  expect(skippedOrder).toEqual(["flow-task-b", "flow-task-a"]);

  await flowCard(page, "Inbox zero").getByRole("button", { name: "Complete task" }).click();
  await expect(completedRow(page, "Inbox zero")).toBeVisible();

  await completedRow(page, "Inbox zero").getByRole("button", { name: "Undo complete task" }).click();
  await expect(flowCard(page, "Inbox zero")).toBeVisible();

  await flowCard(page, "Inbox zero").getByRole("button", { name: "Return to pool" }).click();
  await expect(flowCard(page, "Inbox zero")).toHaveCount(0);
  await expect(taskPoolCard(page, "Inbox zero")).toBeVisible();
});

test("[UI-010] Deleted-task dialog restores a soft-deleted local task", async ({
  page,
  request,
}) => {
  await seedAppState(request, "shell-empty");
  await openApp(page);

  await page.getByTestId("quick-add-input").fill("Restore me");
  await page.getByTestId("quick-add-submit").click();

  const poolCard = taskPoolCard(page, "Restore me");
  await poolCard.hover();
  await poolCard.getByTitle("Delete task").click();

  await expect.poll(async () => {
    const response = await request.get("/api/tasks/deleted");
    const deletedTasks = (await response.json()) as Array<{ title: string }>;
    return deletedTasks.some((task) => task.title === "Restore me");
  }).toBe(true);

  const deletedResponsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/tasks/deleted") &&
      response.request().method() === "GET"
  );
  await page.getByRole("button", { name: "Deleted tasks" }).click();
  const deletedResponse = await deletedResponsePromise;
  const deletedTasks = (await deletedResponse.json()) as Array<{ title: string }>;
  expect(deletedTasks.some((task) => task.title === "Restore me")).toBe(true);
  await expect(page.getByRole("heading", { name: "Deleted Tasks" })).toBeVisible();
  await page.getByPlaceholder("Search deleted...").fill("Restore me");
  await expect(page.getByText("Search results (1)")).toBeVisible();
  await expect(page.getByText("Restore me")).toBeVisible();
  await page.getByTitle("Restore task").click({ force: true });
  await page.keyboard.press("Escape");

  await expect(taskPoolCard(page, "Restore me")).toBeVisible();
});

test("[UI-016] Tasks deleted in Todoist disappear from the sidebar after sync", async ({
  page,
  request,
}) => {
  await seedAppState(request, "todoist-overdue");
  await openApp(page);

  await expect(page.getByRole("button", { name: /^Overdue/ })).toBeVisible();
  await expect(taskPoolCard(page, "Survives sync")).toBeVisible();
  await expect(taskPoolCard(page, "Deleted in Todoist")).toBeVisible();

  // Simulate the next sync: Todoist now only returns "td-keep". The other
  // task is treated as deleted-in-Todoist and gets sync-soft-deleted.
  await simulateTodoistOrphanSweep(request, ["td-keep"]);

  await page.reload();

  await expect(taskPoolCard(page, "Survives sync")).toBeVisible();
  await expect(taskPoolCard(page, "Deleted in Todoist")).toHaveCount(0);

  // Sync-deleted tasks must NOT clutter the trash dialog — the user manages
  // those in Todoist itself. The dialog is reserved for FlowDay-local deletes.
  await page.getByRole("button", { name: "Deleted tasks" }).click();
  await expect(page.getByRole("heading", { name: "Deleted Tasks" })).toBeVisible();
  await expect(page.getByText("Deleted in Todoist")).toHaveCount(0);
});

test("[UI-011] Settings, export, and analytics dialogs smoke test", async ({
  page,
  request,
}) => {
  await seedAppState(request, "analytics-seeded");
  await openApp(page);

  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();

  await page.getByTestId("capacity-input").fill("1");
  await page.getByTestId("capacity-save").click();
  await page.keyboard.press("Escape");

  await expect(page.getByText("You've planned ~4h for a 1h day")).toBeVisible();

  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByTestId("open-export-dialog").click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("download-export").click();
  const download = await downloadPromise;
  expect(await download.path()).toBeTruthy();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Analytics" }).click();
  await expect(page.getByRole("heading", { name: "Analytics" })).toBeVisible();
  await page.getByRole("button", { name: "Weekly Review" }).click();
  await expect(page.getByText("Daily Trend")).toBeVisible();
  await page.getByRole("button", { name: "Work Patterns" }).click();
  await expect(page.getByText("Peak Work Hours")).toBeVisible();
});

import { test, expect } from "@playwright/test";
import {
  flowCard,
  openApp,
  resetAppState,
  seedAppState,
} from "./helpers/e2e";

test.beforeEach(async ({ request }) => {
  await resetAppState(request);
});

test("[UI-001] App shell renders on a clean day", async ({ page, request }) => {
  await seedAppState(request, "shell-empty");
  await openApp(page);

  await expect(page.getByText("Todoist")).toBeVisible();
  await expect(page.getByTestId("day-flow-empty-state")).toBeVisible();
  await expect(page.getByText("Your day flow will appear here")).toBeVisible();
  await expect(page.getByRole("button", { name: "Settings" })).toBeVisible();
});

test("[UI-002] Start Your Day wizard stays open after the first add", async ({ page, request }) => {
  await seedAppState(request, "wizard-today-tasks");
  await openApp(page);

  await expect(page.getByText("Start Your Day")).toBeVisible();

  await page.getByTestId("planning-add-task-wizard-task-1").click();

  await expect(page.getByText("Start Your Day")).toBeVisible();
  await expect(page.getByText("1 task in flow")).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
});

test("[UI-003] Start Your Day wizard completes and persists the plan", async ({ page, request }) => {
  await seedAppState(request, "wizard-today-tasks");
  await openApp(page);

  await page.getByTestId("planning-add-task-wizard-task-1").click();
  await page.getByTestId("planning-add-task-wizard-task-2").click();

  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Review your plan")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("You're all set!")).toBeVisible();
  await page.getByRole("button", { name: "Start My Day" }).click();

  await expect(flowCard(page, "Review roadmap")).toBeVisible();
  await expect(flowCard(page, "Draft release notes")).toBeVisible();

  await page.reload();
  await expect(flowCard(page, "Review roadmap")).toBeVisible();
  await expect(flowCard(page, "Draft release notes")).toBeVisible();
});

test("[UI-012] @portrait portrait wizard flow keeps controls readable and tappable", async ({
  page,
  request,
}) => {
  await seedAppState(request, "wizard-today-tasks");
  await openApp(page);

  await page.getByTestId("planning-add-task-wizard-task-1").click();
  await expect(page.getByText("Start Your Day")).toBeVisible();

  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Start My Day" }).click();

  const card = flowCard(page, "Review roadmap");
  await expect(card).toBeVisible();

  const projectFontSize = await card
    .getByText("FlowDay", { exact: true })
    .evaluate((el) => Number.parseFloat(window.getComputedStyle(el).fontSize));
  expect(projectFontSize).toBeGreaterThanOrEqual(13);

  const startButtonBox = await card.getByRole("button", { name: "Start timer" }).boundingBox();
  expect(startButtonBox).not.toBeNull();
  expect(startButtonBox!.width).toBeGreaterThanOrEqual(28);
  expect(startButtonBox!.height).toBeGreaterThanOrEqual(28);
});

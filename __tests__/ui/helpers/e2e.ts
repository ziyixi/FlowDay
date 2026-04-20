import { expect, type APIRequestContext, type Locator, type Page } from "@playwright/test";

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const todayDate = new Date();
const yesterdayDate = new Date(todayDate);
yesterdayDate.setDate(yesterdayDate.getDate() - 1);

export const TODAY = formatDate(todayDate);
export const YESTERDAY = formatDate(yesterdayDate);
export const FIXED_TIME_ISO = `${TODAY}T09:00:00.000Z`;

interface SeedPayload {
  tasks?: Array<{
    id: string;
    todoistId?: string | null;
    title: string;
    description?: string | null;
    projectName?: string | null;
    projectColor?: string | null;
    priority?: 1 | 2 | 3 | 4;
    labels?: string[];
    estimatedMins?: number | null;
    isCompleted?: boolean;
    completedAt?: string | null;
    dueDate?: string | null;
    createdAt?: string;
    deletedAt?: string | null;
  }>;
  flows?: Record<string, string[]>;
  completedTasks?: Record<string, string[]>;
  notes?: Array<{ taskId: string; flowDate: string; content: string }>;
  timeEntries?: Array<{
    id?: string;
    taskId: string;
    flowDate: string;
    startTime: string;
    endTime?: string | null;
    durationS?: number | null;
    source?: "timer" | "manual";
  }>;
  settings?: Record<string, string | number | boolean>;
}

export type SeedName =
  | "shell-empty"
  | "wizard-today-tasks"
  | "single-flow-task"
  | "two-flow-tasks"
  | "analytics-seeded";

function localTask(
  id: string,
  title: string,
  overrides: Partial<NonNullable<SeedPayload["tasks"]>[number]> = {}
) {
  return {
    id,
    todoistId: null,
    title,
    projectName: "FlowDay",
    projectColor: "#4a9eff",
    priority: 1 as const,
    labels: [],
    dueDate: TODAY,
    createdAt: FIXED_TIME_ISO,
    ...overrides,
  };
}

function buildSeed(name: SeedName): SeedPayload {
  switch (name) {
    case "shell-empty":
      return {
        settings: {
          [`planning_completed:${TODAY}`]: true,
          day_capacity_mins: 360,
        },
      };

    case "wizard-today-tasks":
      return {
        tasks: [
          localTask("wizard-task-1", "Review roadmap", {
            estimatedMins: 30,
            priority: 3,
          }),
          localTask("wizard-task-2", "Draft release notes", {
            estimatedMins: 45,
          }),
        ],
        settings: {
          day_capacity_mins: 360,
        },
      };

    case "single-flow-task":
      return {
        tasks: [
          localTask("flow-task-1", "Deep work block", {
            estimatedMins: 45,
            labels: ["focus"],
          }),
        ],
        flows: {
          [TODAY]: ["flow-task-1"],
        },
        settings: {
          [`planning_completed:${TODAY}`]: true,
          day_capacity_mins: 360,
        },
      };

    case "two-flow-tasks":
      return {
        tasks: [
          localTask("flow-task-a", "Inbox zero", { estimatedMins: 20 }),
          localTask("flow-task-b", "Implement feature", {
            estimatedMins: 90,
            priority: 3,
          }),
        ],
        flows: {
          [TODAY]: ["flow-task-a", "flow-task-b"],
        },
        settings: {
          [`planning_completed:${TODAY}`]: true,
          day_capacity_mins: 360,
        },
      };

    case "analytics-seeded":
      return {
        tasks: [
          localTask("analytics-task-1", "Write proposal", {
            estimatedMins: 180,
            priority: 3,
          }),
          localTask("analytics-task-2", "Review plan", {
            estimatedMins: 30,
          }),
        ],
        flows: {
          [TODAY]: ["analytics-task-1", "analytics-task-2"],
        },
        completedTasks: {
          [TODAY]: ["analytics-task-2"],
        },
        timeEntries: [
          {
            taskId: "analytics-task-2",
            flowDate: TODAY,
            startTime: `${TODAY}T08:00:00.000Z`,
            endTime: `${TODAY}T08:25:00.000Z`,
            durationS: 1500,
            source: "timer",
          },
        ],
        settings: {
          [`planning_completed:${TODAY}`]: true,
          day_capacity_mins: 360,
        },
      };
    default:
      throw new Error(`Unknown seed "${name}"`);
  }
}

export async function resetAppState(request: APIRequestContext) {
  const response = await request.post("/api/test/reset");
  expect(response.ok()).toBeTruthy();
}

export async function seedAppState(request: APIRequestContext, name: SeedName) {
  const response = await request.post("/api/test/seed", {
    data: buildSeed(name),
  });
  expect(response.ok()).toBeTruthy();
}

export async function installFixedClock(page: Page) {
  await page.clock.install({ time: new Date(FIXED_TIME_ISO) });
}

export async function setRunningTimerElapsed(page: Page, seconds: number) {
  await page.evaluate((elapsedSeconds) => {
    window.__FLOWDAY_E2E__?.setRunningTimerElapsed(elapsedSeconds);
  }, seconds);
}

export async function getTimerState(page: Page) {
  return page.evaluate(() => window.__FLOWDAY_E2E__?.getTimerState() ?? null);
}

export async function getChimeCount(page: Page): Promise<number> {
  return page.evaluate(() => window.__FLOWDAY_E2E__?.getChimeCount() ?? 0);
}

export async function resetChimeCount(page: Page) {
  await page.evaluate(() => window.__FLOWDAY_E2E__?.resetChimeCount());
}

export async function simulateIdleAway(page: Page, secondsAgo: number) {
  await page.evaluate(
    (s) => window.__FLOWDAY_E2E__?.simulateIdleAway(s),
    secondsAgo
  );
}

export async function openApp(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "FlowDay" })).toBeVisible();
}

export function flowCard(page: Page, title: string): Locator {
  return page.locator('[data-testid="flow-task-card"]', {
    has: page.getByText(title, { exact: true }),
  });
}

export function flowCardById(page: Page, taskId: string): Locator {
  return page.locator(`[data-testid="flow-task-card"][data-task-id="${taskId}"]`);
}

export function completedRow(page: Page, title: string): Locator {
  return page.locator('[data-testid="completed-task-row"]', {
    has: page.getByText(title, { exact: true }),
  });
}

export function taskPoolCard(page: Page, title: string): Locator {
  return page.locator('[data-testid="task-pool-card"]', {
    has: page.getByText(title, { exact: true }),
  });
}

export async function dragTaskToEmptyFlow(page: Page, title: string) {
  const source = taskPoolCard(page, title);
  const target = page.getByTestId("day-flow-empty-state");
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();

  if (!sourceBox || !targetBox) {
    throw new Error("Unable to resolve drag source or target bounds");
  }

  await page.mouse.move(
    sourceBox.x + sourceBox.width / 2,
    sourceBox.y + sourceBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    targetBox.x + targetBox.width / 2,
    targetBox.y + targetBox.height / 2,
    { steps: 12 }
  );
  await page.mouse.up();
}

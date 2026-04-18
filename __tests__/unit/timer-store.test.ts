import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTimerStore } from "@/lib/stores/timer-store";

function resetTimerStore() {
  useTimerStore.getState().stopWithoutSaving();
  useTimerStore.setState({
    activeTaskId: null,
    activeFlowDate: null,
    status: "idle",
    timerMode: "countup",
    pomodoroTargetSeconds: null,
    segmentWallStart: null,
    segmentStartedAt: null,
    sessionSavedSeconds: 0,
    priorSeconds: 0,
    displaySeconds: 0,
    entryRevision: 0,
  });
}

describe("timer store", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-13T09:00:00.000Z"));
    resetTimerStore();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    resetTimerStore();
  });

  it("switches active tasks and saves the previous running segment", async () => {
    const posts: Array<{
      taskId: string;
      flowDate: string;
      durationS: number;
      source: string;
    }> = [];

    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";

      if (url.startsWith("/api/entries?taskId=") && method === "GET") {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url === "/api/entries" && method === "POST") {
        const body = JSON.parse(String(init?.body ?? "{}")) as {
          taskId: string;
          flowDate: string;
          durationS: number;
          source: string;
        };
        posts.push(body);
        return new Response(JSON.stringify({ id: crypto.randomUUID() }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
      }

      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    await useTimerStore.getState().startTimer("task-1", "2026-04-13");
    await vi.advanceTimersByTimeAsync(5000);
    await useTimerStore.getState().startTimer("task-2", "2026-04-13");

    const state = useTimerStore.getState();
    expect(state.activeTaskId).toBe("task-2");
    expect(state.status).toBe("running");
    expect(state.timerMode).toBe("countup");

    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({
      taskId: "task-1",
      flowDate: "2026-04-13",
      durationS: 5,
      source: "timer",
    });
  });

  it("auto-stops pomodoro at target, saves time, and clears active timer state", async () => {
    const posts: Array<{
      taskId: string;
      flowDate: string;
      durationS: number;
      source: string;
    }> = [];

    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";

      if (url.startsWith("/api/entries?taskId=") && method === "GET") {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url === "/api/entries" && method === "POST") {
        const body = JSON.parse(String(init?.body ?? "{}")) as {
          taskId: string;
          flowDate: string;
          durationS: number;
          source: string;
        };
        posts.push(body);
        return new Response(JSON.stringify({ id: crypto.randomUUID() }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
      }

      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    await useTimerStore.getState().startPomodoro("task-1", "2026-04-13", 3);
    await vi.advanceTimersByTimeAsync(3000);

    const state = useTimerStore.getState();
    expect(state.activeTaskId).toBeNull();
    expect(state.status).toBe("idle");
    expect(state.timerMode).toBe("countup");
    expect(state.displaySeconds).toBe(0);

    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({
      taskId: "task-1",
      flowDate: "2026-04-13",
      durationS: 3,
      source: "timer",
    });
  });
});

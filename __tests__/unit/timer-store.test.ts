import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTimerStore } from "@/lib/stores/timer-store";
import { _getChimeCount, _resetChime } from "@/lib/utils/chime";

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
    pomodoroFinishedTaskId: null,
    pomodoroFinishedFlowDate: null,
    pomodoroFinishedTargetSeconds: null,
  });
}

describe("timer store", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-13T09:00:00.000Z"));
    resetTimerStore();
    _resetChime();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    resetTimerStore();
    _resetChime();
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

  it("plays a completion chime exactly once when a pomodoro reaches zero", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";
      if (url.startsWith("/api/entries?taskId=") && method === "GET") {
        return new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url === "/api/entries" && method === "POST") {
        return new Response(JSON.stringify({ id: "x" }), { status: 201, headers: { "Content-Type": "application/json" } });
      }
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    expect(_getChimeCount()).toBe(0);

    await useTimerStore.getState().startPomodoro("task-1", "2026-04-13", 2);
    await vi.advanceTimersByTimeAsync(2000);

    expect(_getChimeCount()).toBe(1);

    // Idempotence guard: extra ticks after completion must not double-fire.
    await vi.advanceTimersByTimeAsync(3000);
    expect(_getChimeCount()).toBe(1);
  });

  it("marks the finished-pomodoro slot when the timer hits zero, and clears it on next start", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";
      if (url.startsWith("/api/entries?taskId=") && method === "GET") {
        return new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url === "/api/entries" && method === "POST") {
        return new Response(JSON.stringify({ id: "x" }), { status: 201, headers: { "Content-Type": "application/json" } });
      }
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await useTimerStore.getState().startPomodoro("task-1", "2026-04-21", 4);
    await vi.advanceTimersByTimeAsync(4000);

    let state = useTimerStore.getState();
    // Active timer is gone, but the finished marker captures what just ended so
    // the pop-out can offer restart/complete instead of a bare idle screen.
    expect(state.activeTaskId).toBeNull();
    expect(state.status).toBe("idle");
    expect(state.pomodoroFinishedTaskId).toBe("task-1");
    expect(state.pomodoroFinishedFlowDate).toBe("2026-04-21");
    expect(state.pomodoroFinishedTargetSeconds).toBe(4);

    // Starting a new count-up timer clears the finished marker so the UI
    // doesn't double-render a stale "pomodoro done" panel.
    await useTimerStore.getState().startTimer("task-2", "2026-04-21");
    state = useTimerStore.getState();
    expect(state.pomodoroFinishedTaskId).toBeNull();
    expect(state.pomodoroFinishedFlowDate).toBeNull();
    expect(state.pomodoroFinishedTargetSeconds).toBeNull();
  });

  it("clears the finished-pomodoro slot on restart via startPomodoro", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";
      if (url.startsWith("/api/entries?taskId=") && method === "GET") {
        return new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url === "/api/entries" && method === "POST") {
        return new Response(JSON.stringify({ id: "x" }), { status: 201, headers: { "Content-Type": "application/json" } });
      }
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await useTimerStore.getState().startPomodoro("task-1", "2026-04-21", 3);
    await vi.advanceTimersByTimeAsync(3000);
    expect(useTimerStore.getState().pomodoroFinishedTaskId).toBe("task-1");

    await useTimerStore.getState().startPomodoro("task-1", "2026-04-21", 60);
    const state = useTimerStore.getState();
    expect(state.pomodoroFinishedTaskId).toBeNull();
    expect(state.activeTaskId).toBe("task-1");
    expect(state.timerMode).toBe("pomodoro");
  });

  it("dismissPomodoroFinished clears the marker without touching the active timer", async () => {
    useTimerStore.setState({
      pomodoroFinishedTaskId: "task-1",
      pomodoroFinishedFlowDate: "2026-04-21",
      pomodoroFinishedTargetSeconds: 60,
    });
    useTimerStore.getState().dismissPomodoroFinished();
    const state = useTimerStore.getState();
    expect(state.pomodoroFinishedTaskId).toBeNull();
    expect(state.pomodoroFinishedFlowDate).toBeNull();
    expect(state.pomodoroFinishedTargetSeconds).toBeNull();
    // No timer was running — status must remain idle.
    expect(state.status).toBe("idle");
    expect(state.activeTaskId).toBeNull();
  });

  it("does not chime for count-up timers regardless of elapsed time", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";
      if (url.startsWith("/api/entries?taskId=") && method === "GET") {
        return new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url === "/api/entries" && method === "POST") {
        return new Response(JSON.stringify({ id: "x" }), { status: 201, headers: { "Content-Type": "application/json" } });
      }
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await useTimerStore.getState().startTimer("task-1", "2026-04-13");
    await vi.advanceTimersByTimeAsync(60_000);
    await useTimerStore.getState().stopAndSave();

    expect(_getChimeCount()).toBe(0);
  });
});

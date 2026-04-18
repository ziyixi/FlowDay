import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getEntriesByTask } from "@/lib/db/queries";
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

async function dispatchEntriesFetch(input: string | URL | Request, init?: RequestInit) {
  const mod = await import("@/app/api/entries/route");
  const rawUrl = typeof input === "string" ? input : input.toString();
  const url = rawUrl.startsWith("http")
    ? rawUrl
    : `http://localhost:3000${rawUrl}`;
  const method = init?.method ?? "GET";
  const request = new Request(url, {
    method,
    headers: init?.headers,
    body: init?.body,
  });

  if (method === "GET") {
    return mod.GET(request);
  }

  if (method === "POST") {
    return mod.POST(request);
  }

  throw new Error(`Unsupported method for test fetch: ${method}`);
}

describe("timer store -> entries API integration", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-13T09:00:00.000Z"));
    resetTimerStore();
    vi.stubGlobal("fetch", dispatchEntriesFetch as typeof fetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    resetTimerStore();
  });

  it("persists prior timer entry when switching tasks", async () => {
    await useTimerStore.getState().startTimer("task-1", "2026-04-13");
    await vi.advanceTimersByTimeAsync(5000);
    await useTimerStore.getState().startTimer("task-2", "2026-04-13");

    const task1Entries = getEntriesByTask("task-1");
    expect(task1Entries).toHaveLength(1);
    expect(task1Entries[0]).toMatchObject({
      taskId: "task-1",
      flowDate: "2026-04-13",
      durationS: 5,
      source: "timer",
    });

    const state = useTimerStore.getState();
    expect(state.activeTaskId).toBe("task-2");
    expect(state.status).toBe("running");
  });

  it("persists pomodoro as a normal timer entry and clears active state on completion", async () => {
    await useTimerStore.getState().startPomodoro("task-1", "2026-04-13", 3);
    await vi.advanceTimersByTimeAsync(3000);

    const entries = getEntriesByTask("task-1");
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      taskId: "task-1",
      flowDate: "2026-04-13",
      durationS: 3,
      source: "timer",
    });

    const state = useTimerStore.getState();
    expect(state.activeTaskId).toBeNull();
    expect(state.status).toBe("idle");
  });
});

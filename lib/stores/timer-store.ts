import { create } from "zustand";

interface TimerState {
  activeTaskId: string | null;
  activeFlowDate: string | null;
  status: "idle" | "running" | "paused";

  // Current running segment wall-clock start (ISO string for the entry)
  segmentWallStart: string | null;
  // Date.now() of current segment start (for computing live elapsed)
  segmentStartedAt: number | null;

  // Accumulated seconds from segments saved during this timer session
  sessionSavedSeconds: number;
  // Seconds from prior DB entries (fetched on start)
  priorSeconds: number;
  // Display value updated every tick
  displaySeconds: number;
  // Monotonic counter bumped when entries are persisted
  entryRevision: number;

  startTimer: (taskId: string, flowDate: string) => Promise<void>;
  pauseTimer: () => void;
  resumeTimer: () => void;
  stopAndSave: () => Promise<void>;
  stopWithoutSaving: () => void;
  tick: () => void;
}

let intervalId: ReturnType<typeof setInterval> | null = null;

function clearTickInterval() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

function startTickInterval(tick: () => void) {
  clearTickInterval();
  intervalId = setInterval(tick, 1000);
}

function currentSegmentSeconds(state: TimerState): number {
  if (!state.segmentStartedAt) return 0;
  return Math.floor((Date.now() - state.segmentStartedAt) / 1000);
}

function totalSeconds(state: TimerState): number {
  return state.priorSeconds + state.sessionSavedSeconds + currentSegmentSeconds(state);
}

async function saveSegment(state: TimerState): Promise<void> {
  const segSeconds = currentSegmentSeconds(state);
  if (
    segSeconds <= 0 ||
    !state.segmentWallStart ||
    !state.activeTaskId ||
    !state.activeFlowDate
  )
    return;

  const endTime = new Date().toISOString();

  try {
    await fetch("/api/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId: state.activeTaskId,
        flowDate: state.activeFlowDate,
        startTime: state.segmentWallStart,
        endTime,
        durationS: segSeconds,
        source: "timer",
      }),
    });
  } catch {
    // Silently fail — user can manually log if save failed
  }
}

async function fetchPriorSeconds(taskId: string): Promise<number> {
  try {
    const res = await fetch(
      `/api/entries?taskId=${encodeURIComponent(taskId)}`,
      { cache: "no-store" }
    );
    if (!res.ok) return 0;
    const entries = await res.json();
    return entries.reduce(
      (sum: number, e: { durationS: number | null }) => sum + (e.durationS ?? 0),
      0
    );
  } catch {
    return 0;
  }
}

function resetState(): Omit<TimerState, "entryRevision" | "startTimer" | "pauseTimer" | "resumeTimer" | "stopAndSave" | "stopWithoutSaving" | "tick"> {
  return {
    activeTaskId: null,
    activeFlowDate: null,
    status: "idle" as const,
    segmentWallStart: null,
    segmentStartedAt: null,
    sessionSavedSeconds: 0,
    priorSeconds: 0,
    displaySeconds: 0,
  };
}

export const useTimerStore = create<TimerState>()((set, get) => ({
  activeTaskId: null,
  activeFlowDate: null,
  status: "idle",
  segmentWallStart: null,
  segmentStartedAt: null,
  sessionSavedSeconds: 0,
  priorSeconds: 0,
  displaySeconds: 0,
  entryRevision: 0,

  startTimer: async (taskId, flowDate) => {
    const state = get();

    // If another task is active, stop and save it first — AWAIT to prevent data loss
    if (state.activeTaskId && state.activeTaskId !== taskId && state.status !== "idle") {
      clearTickInterval();
      await saveSegment(state);
      set((prev) => ({ entryRevision: prev.entryRevision + 1 }));
    }

    // Fetch prior seconds BEFORE setting state to avoid flash-to-zero
    const prior = await fetchPriorSeconds(taskId);

    // Guard: user might have clicked something else during the await
    const current = get();
    if (current.activeTaskId && current.activeTaskId !== taskId && current.status === "running") {
      return; // Another timer was started while we were fetching — bail
    }

    const now = Date.now();
    set({
      activeTaskId: taskId,
      activeFlowDate: flowDate,
      status: "running",
      segmentWallStart: new Date(now).toISOString(),
      segmentStartedAt: now,
      sessionSavedSeconds: 0,
      priorSeconds: prior,
      displaySeconds: prior,
    });

    startTickInterval(() => get().tick());
  },

  pauseTimer: async () => {
    const state = get();
    if (state.status !== "running") return;

    const segSeconds = currentSegmentSeconds(state);
    clearTickInterval();

    // Save this segment as an entry
    await saveSegment(state);
    set((prev) => ({
      status: "paused",
      sessionSavedSeconds: state.sessionSavedSeconds + segSeconds,
      segmentWallStart: null,
      segmentStartedAt: null,
      entryRevision: prev.entryRevision + 1,
    }));
  },

  resumeTimer: () => {
    const state = get();
    if (state.status !== "paused") return;

    set({
      status: "running",
      segmentWallStart: new Date().toISOString(),
      segmentStartedAt: Date.now(),
    });

    startTickInterval(() => get().tick());
  },

  stopAndSave: async () => {
    const state = get();
    if (state.status === "idle") return;

    clearTickInterval();

    // Save current segment if running
    if (state.status === "running") {
      await saveSegment(state);
    }
    set((prev) => ({
      ...resetState(),
      entryRevision:
        state.status === "running"
          ? prev.entryRevision + 1
          : prev.entryRevision,
    }));
  },

  stopWithoutSaving: () => {
    clearTickInterval();
    set((prev) => ({ ...resetState(), entryRevision: prev.entryRevision }));
  },

  tick: () => {
    const state = get();
    if (state.status !== "running") return;
    set({ displaySeconds: totalSeconds(state) });
  },
}));

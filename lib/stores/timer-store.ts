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

  startTimer: (taskId: string, flowDate: string) => void;
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

function resetState(): Partial<TimerState> {
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

  startTimer: (taskId, flowDate) => {
    const state = get();

    // If another task is active, stop and save it first
    if (state.activeTaskId && state.activeTaskId !== taskId && state.status !== "idle") {
      clearTickInterval();
      saveSegment(state);
    }

    // Fetch prior seconds asynchronously, then update
    fetchPriorSeconds(taskId).then((prior) => {
      // Only update if this task is still active (user might have switched)
      if (get().activeTaskId === taskId) {
        set({ priorSeconds: prior, displaySeconds: prior });
      }
    });

    set({
      activeTaskId: taskId,
      activeFlowDate: flowDate,
      status: "running",
      segmentWallStart: new Date().toISOString(),
      segmentStartedAt: Date.now(),
      sessionSavedSeconds: 0,
      priorSeconds: 0,
      displaySeconds: 0,
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

    set({
      status: "paused",
      sessionSavedSeconds: state.sessionSavedSeconds + segSeconds,
      segmentWallStart: null,
      segmentStartedAt: null,
    });
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

    set(resetState());
  },

  stopWithoutSaving: () => {
    clearTickInterval();
    set(resetState());
  },

  tick: () => {
    const state = get();
    if (state.status !== "running") return;
    set({ displaySeconds: totalSeconds(state) });
  },
}));

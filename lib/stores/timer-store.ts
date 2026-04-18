import { create } from "zustand";

export type TimerMode = "countup" | "pomodoro";

interface TimerState {
  activeTaskId: string | null;
  activeFlowDate: string | null;
  status: "idle" | "running" | "paused";
  timerMode: TimerMode;
  pomodoroTargetSeconds: number | null;

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
  startPomodoro: (
    taskId: string,
    flowDate: string,
    targetSeconds: number
  ) => Promise<void>;
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

function pomodoroRemainingSeconds(state: TimerState): number {
  if (state.pomodoroTargetSeconds == null) return 0;
  const elapsed = state.sessionSavedSeconds + currentSegmentSeconds(state);
  return Math.max(state.pomodoroTargetSeconds - elapsed, 0);
}

async function clearCurrentTimerForStart(
  state: TimerState
): Promise<void> {
  if (state.status === "idle") return;

  clearTickInterval();

  if (state.status === "running") {
    await saveSegment(state);
    useTimerStore.setState((prev) => ({
      ...resetState(),
      entryRevision: prev.entryRevision + 1,
    }));
    return;
  }

  useTimerStore.setState((prev) => ({
    ...resetState(),
    entryRevision: prev.entryRevision,
  }));
}

async function saveSegment(
  state: TimerState,
  durationOverrideS?: number
): Promise<void> {
  const segSeconds = durationOverrideS ?? currentSegmentSeconds(state);
  if (
    segSeconds <= 0 ||
    !state.segmentWallStart ||
    !state.activeTaskId ||
    !state.activeFlowDate
  )
    return;

  const segmentStartMs = new Date(state.segmentWallStart).getTime();
  const endTime = new Date(segmentStartMs + segSeconds * 1000).toISOString();

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

function resetState(): Omit<
  TimerState,
  | "entryRevision"
  | "startTimer"
  | "startPomodoro"
  | "pauseTimer"
  | "resumeTimer"
  | "stopAndSave"
  | "stopWithoutSaving"
  | "tick"
> {
  return {
    activeTaskId: null,
    activeFlowDate: null,
    status: "idle" as const,
    timerMode: "countup" as const,
    pomodoroTargetSeconds: null,
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
  timerMode: "countup",
  pomodoroTargetSeconds: null,
  segmentWallStart: null,
  segmentStartedAt: null,
  sessionSavedSeconds: 0,
  priorSeconds: 0,
  displaySeconds: 0,
  entryRevision: 0,

  startTimer: async (taskId, flowDate) => {
    const state = get();

    // Clear any existing timer state before switching tasks/modes.
    if (state.status !== "idle" && state.activeTaskId !== taskId) {
      await clearCurrentTimerForStart(state);
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
      timerMode: "countup",
      pomodoroTargetSeconds: null,
      segmentWallStart: new Date(now).toISOString(),
      segmentStartedAt: now,
      sessionSavedSeconds: 0,
      priorSeconds: prior,
      displaySeconds: prior,
    });

    startTickInterval(() => get().tick());
  },

  startPomodoro: async (taskId, flowDate, targetSeconds) => {
    if (!Number.isFinite(targetSeconds) || targetSeconds <= 0) return;

    const state = get();

    // Starting a pomodoro always replaces the previous active timer state.
    if (state.status !== "idle") {
      await clearCurrentTimerForStart(state);
    }

    // Keep parity with count-up mode for data consistency across UI refreshes
    const prior = await fetchPriorSeconds(taskId);

    // Guard: user might have clicked something else during the await
    const current = get();
    if (
      current.activeTaskId &&
      current.activeTaskId !== taskId &&
      current.status === "running"
    ) {
      return;
    }

    const now = Date.now();
    set({
      activeTaskId: taskId,
      activeFlowDate: flowDate,
      status: "running",
      timerMode: "pomodoro",
      pomodoroTargetSeconds: targetSeconds,
      segmentWallStart: new Date(now).toISOString(),
      segmentStartedAt: now,
      sessionSavedSeconds: 0,
      priorSeconds: prior,
      displaySeconds: targetSeconds,
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
    const nextSessionSaved = state.sessionSavedSeconds + segSeconds;
    const nextDisplay =
      state.timerMode === "pomodoro"
        ? Math.max((state.pomodoroTargetSeconds ?? 0) - nextSessionSaved, 0)
        : state.priorSeconds + nextSessionSaved;
    set((prev) => ({
      status: "paused",
      sessionSavedSeconds: nextSessionSaved,
      segmentWallStart: null,
      segmentStartedAt: null,
      displaySeconds: nextDisplay,
      entryRevision: prev.entryRevision + 1,
    }));
  },

  resumeTimer: () => {
    const state = get();
    if (state.status !== "paused") return;
    if (
      state.timerMode === "pomodoro" &&
      state.pomodoroTargetSeconds != null &&
      state.sessionSavedSeconds >= state.pomodoroTargetSeconds
    ) {
      return;
    }

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

    if (state.timerMode === "pomodoro") {
      const remaining = pomodoroRemainingSeconds(state);
      if (remaining <= 0) {
        clearTickInterval();
        const segSecondsToSave = Math.max(
          (state.pomodoroTargetSeconds ?? 0) - state.sessionSavedSeconds,
          0
        );

        void (async () => {
          if (segSecondsToSave > 0) {
            await saveSegment(state, segSecondsToSave);
          }

          set((prev) => ({
            ...resetState(),
            entryRevision:
              prev.entryRevision + (segSecondsToSave > 0 ? 1 : 0),
          }));
        })();
        return;
      }

      set({ displaySeconds: remaining });
      return;
    }

    set({ displaySeconds: totalSeconds(state) });
  },
}));

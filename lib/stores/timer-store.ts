import { create } from "zustand";
import { playCompletionChime } from "@/lib/utils/chime";

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

  // Transient marker set when a pomodoro hits zero so the pop-out can render a
  // "restart or complete" panel instead of falling back to the generic idle view.
  // Cleared by any explicit user action (start new timer, restart pomodoro,
  // complete, or dismiss).
  pomodoroFinishedTaskId: string | null;
  pomodoroFinishedFlowDate: string | null;
  pomodoroFinishedTargetSeconds: number | null;

  startTimer: (taskId: string, flowDate: string) => Promise<void>;
  startPomodoro: (
    taskId: string,
    flowDate: string,
    targetSeconds: number
  ) => Promise<void>;
  pauseTimer: (effectiveStopMs?: number) => Promise<void>;
  resumeTimer: () => void;
  stopAndSave: () => Promise<void>;
  stopWithoutSaving: () => void;
  dismissPomodoroFinished: () => void;
  hydrateSession: () => Promise<void>;
  tick: () => void;
}

let intervalId: ReturnType<typeof setInterval> | null = null;

// Drop a running segment on hydrate if its wall-clock start is this far in the
// past — 6 hours assumes any single unattended session that old was abandoned
// (laptop closed, device forgotten) and the auto-idle hook would have paused a
// live session long before this.
const STALE_RUNNING_SEGMENT_MS = 6 * 60 * 60 * 1000;
// Skip hydrating a finished-pomodoro marker older than this. Comes back to
// "so stale it's noise" territory — user can always restart.
const STALE_FINISHED_MARKER_MS = 60 * 60 * 1000;

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

// Fire-and-forget write of the current store state to the server so another
// device picks it up on next load. Failures are silent — the local session is
// still the source of truth until the next save succeeds.
function persistCurrentSession() {
  if (typeof fetch === "undefined") return;
  const s = useTimerStore.getState();
  if (
    s.status === "idle" &&
    !s.pomodoroFinishedTaskId &&
    !s.activeTaskId
  ) {
    void fetch("/api/timer/session", { method: "DELETE" }).catch(() => {});
    return;
  }
  void fetch("/api/timer/session", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      taskId: s.activeTaskId,
      flowDate: s.activeFlowDate,
      status: s.status,
      timerMode: s.timerMode,
      pomodoroTargetS: s.pomodoroTargetSeconds,
      segmentWallStart: s.segmentWallStart,
      sessionSavedS: s.sessionSavedSeconds,
      pomodoroFinishedTaskId: s.pomodoroFinishedTaskId,
      pomodoroFinishedFlowDate: s.pomodoroFinishedFlowDate,
      pomodoroFinishedTargetS: s.pomodoroFinishedTargetSeconds,
    }),
  }).catch(() => {});
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
  | "pomodoroFinishedTaskId"
  | "pomodoroFinishedFlowDate"
  | "pomodoroFinishedTargetSeconds"
  | "startTimer"
  | "startPomodoro"
  | "pauseTimer"
  | "resumeTimer"
  | "stopAndSave"
  | "stopWithoutSaving"
  | "dismissPomodoroFinished"
  | "hydrateSession"
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

interface ServerSessionPayload {
  taskId: string | null;
  flowDate: string | null;
  status: TimerState["status"];
  timerMode: TimerMode;
  pomodoroTargetS: number | null;
  segmentWallStart: string | null;
  sessionSavedS: number;
  pomodoroFinishedTaskId: string | null;
  pomodoroFinishedFlowDate: string | null;
  pomodoroFinishedTargetS: number | null;
  updatedAt: string | null;
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
  pomodoroFinishedTaskId: null,
  pomodoroFinishedFlowDate: null,
  pomodoroFinishedTargetSeconds: null,

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
      pomodoroFinishedTaskId: null,
      pomodoroFinishedFlowDate: null,
      pomodoroFinishedTargetSeconds: null,
    });

    persistCurrentSession();
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
      pomodoroFinishedTaskId: null,
      pomodoroFinishedFlowDate: null,
      pomodoroFinishedTargetSeconds: null,
    });

    persistCurrentSession();
    startTickInterval(() => get().tick());
  },

  dismissPomodoroFinished: () => {
    set({
      pomodoroFinishedTaskId: null,
      pomodoroFinishedFlowDate: null,
      pomodoroFinishedTargetSeconds: null,
    });
    persistCurrentSession();
  },

  pauseTimer: async (effectiveStopMs) => {
    const state = get();
    if (state.status !== "running") return;

    // Backdate the segment to `effectiveStopMs` when provided (used by the
    // auto-idle hook to drop the time the user was away from the screen).
    const segSeconds =
      effectiveStopMs != null && state.segmentStartedAt != null
        ? Math.max(
            Math.floor((effectiveStopMs - state.segmentStartedAt) / 1000),
            0
          )
        : currentSegmentSeconds(state);
    clearTickInterval();

    await saveSegment(state, segSeconds);
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
    persistCurrentSession();
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

    persistCurrentSession();
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
    persistCurrentSession();
  },

  stopWithoutSaving: () => {
    clearTickInterval();
    set((prev) => ({ ...resetState(), entryRevision: prev.entryRevision }));
    persistCurrentSession();
  },

  hydrateSession: async () => {
    if (typeof fetch === "undefined") return;

    const clearHydratedSession = () => {
      clearTickInterval();
      set((prev) => ({
        ...resetState(),
        entryRevision: prev.entryRevision,
        pomodoroFinishedTaskId: null,
        pomodoroFinishedFlowDate: null,
        pomodoroFinishedTargetSeconds: null,
      }));
    };

    let payload: { session: ServerSessionPayload | null } | null = null;
    try {
      const res = await fetch("/api/timer/session", { cache: "no-store" });
      if (!res.ok) return;
      payload = (await res.json()) as { session: ServerSessionPayload | null };
    } catch {
      return;
    }
    const session = payload?.session;
    if (!session) {
      clearHydratedSession();
      return;
    }

    const {
      taskId,
      flowDate,
      status,
      timerMode,
      pomodoroTargetS,
      segmentWallStart,
      sessionSavedS,
      pomodoroFinishedTaskId,
      pomodoroFinishedFlowDate,
      pomodoroFinishedTargetS,
      updatedAt,
    } = session;

    clearTickInterval();

    // Idle + finished marker: restore the "pomodoro complete" panel unless it's
    // so old the user is probably on a different task mentally.
    if (status === "idle" && pomodoroFinishedTaskId) {
      if (updatedAt) {
        const age = Date.now() - Date.parse(updatedAt);
        if (age > STALE_FINISHED_MARKER_MS) {
          clearHydratedSession();
          void fetch("/api/timer/session", { method: "DELETE" }).catch(() => {});
          return;
        }
      }
      set((prev) => ({
        ...resetState(),
        entryRevision: prev.entryRevision,
        pomodoroFinishedTaskId,
        pomodoroFinishedFlowDate,
        pomodoroFinishedTargetSeconds: pomodoroFinishedTargetS,
      }));
      return;
    }

    if (!taskId || !flowDate) {
      clearHydratedSession();
      return;
    }

    // Running session with a stale wall-clock start: treat as abandoned. Fall
    // back to an empty state rather than blindly resuming — the user was
    // probably away and the time shouldn't be logged.
    if (status === "running" && segmentWallStart) {
      const age = Date.now() - Date.parse(segmentWallStart);
      if (age > STALE_RUNNING_SEGMENT_MS) {
        clearHydratedSession();
        void fetch("/api/timer/session", { method: "DELETE" }).catch(() => {});
        return;
      }
    }

    const prior = await fetchPriorSeconds(taskId);

    if (status === "running" && segmentWallStart) {
      const segmentStartedAt = Date.parse(segmentWallStart);
      set({
        activeTaskId: taskId,
        activeFlowDate: flowDate,
        status: "running",
        timerMode,
        pomodoroTargetSeconds: pomodoroTargetS,
        segmentWallStart,
        segmentStartedAt,
        sessionSavedSeconds: sessionSavedS,
        priorSeconds: prior,
        displaySeconds:
          timerMode === "pomodoro"
            ? Math.max((pomodoroTargetS ?? 0) - sessionSavedS, 0)
            : prior + sessionSavedS,
        pomodoroFinishedTaskId: null,
        pomodoroFinishedFlowDate: null,
        pomodoroFinishedTargetSeconds: null,
      });
      // Let tick() compute the correct remaining/elapsed immediately, then
      // start the 1-second interval. If the pomodoro already elapsed while
      // the tab was closed, tick() will save the remaining segment and flip
      // into the finished state.
      get().tick();
      startTickInterval(() => get().tick());
      return;
    }

    if (status === "paused") {
      set({
        activeTaskId: taskId,
        activeFlowDate: flowDate,
        status: "paused",
        timerMode,
        pomodoroTargetSeconds: pomodoroTargetS,
        segmentWallStart: null,
        segmentStartedAt: null,
        sessionSavedSeconds: sessionSavedS,
        priorSeconds: prior,
        displaySeconds:
          timerMode === "pomodoro"
            ? Math.max((pomodoroTargetS ?? 0) - sessionSavedS, 0)
            : prior + sessionSavedS,
        pomodoroFinishedTaskId: null,
        pomodoroFinishedFlowDate: null,
        pomodoroFinishedTargetSeconds: null,
      });
    }
  },

  tick: () => {
    const state = get();
    if (state.status !== "running") return;

    if (state.timerMode === "pomodoro") {
      const remaining = pomodoroRemainingSeconds(state);
      if (remaining <= 0) {
        clearTickInterval();
        playCompletionChime();
        const segSecondsToSave = Math.max(
          (state.pomodoroTargetSeconds ?? 0) - state.sessionSavedSeconds,
          0
        );
        const finishedTaskId = state.activeTaskId;
        const finishedFlowDate = state.activeFlowDate;
        const finishedTarget = state.pomodoroTargetSeconds;

        void (async () => {
          if (segSecondsToSave > 0) {
            await saveSegment(state, segSecondsToSave);
          }

          set((prev) => ({
            ...resetState(),
            entryRevision:
              prev.entryRevision + (segSecondsToSave > 0 ? 1 : 0),
            pomodoroFinishedTaskId: finishedTaskId,
            pomodoroFinishedFlowDate: finishedFlowDate,
            pomodoroFinishedTargetSeconds: finishedTarget,
          }));
          persistCurrentSession();
        })();
        return;
      }

      set({ displaySeconds: remaining });
      return;
    }

    set({ displaySeconds: totalSeconds(state) });
  },
}));

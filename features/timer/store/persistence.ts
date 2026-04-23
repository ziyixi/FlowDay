import { fetchNoStore, jsonRequestInit } from "@/lib/client/http";
import type { TimerState, ServerSessionPayload } from "./types";
import { currentSegmentSeconds } from "./helpers";

interface PersistedTimerSession {
  taskId: string | null;
  flowDate: string | null;
  status: TimerState["status"];
  timerMode: TimerState["timerMode"];
  pomodoroTargetS: number | null;
  segmentWallStart: string | null;
  sessionSavedS: number;
  pomodoroFinishedTaskId: string | null;
  pomodoroFinishedFlowDate: string | null;
  pomodoroFinishedTargetS: number | null;
}

export async function loadPersistedTimerSession(): Promise<ServerSessionPayload | null> {
  const response = await fetchNoStore("/api/timer/session");
  if (!response.ok) return null;
  const payload = (await response.json()) as { session: ServerSessionPayload | null };
  return payload.session;
}

export function persistCurrentSession(session: PersistedTimerSession | null) {
  if (!session) {
    void fetch("/api/timer/session", { method: "DELETE" }).catch(() => {});
    return;
  }

  void fetch("/api/timer/session", jsonRequestInit("PUT", session)).catch(() => {});
}

export function snapshotSessionState(state: TimerState): PersistedTimerSession | null {
  if (state.status === "idle" && !state.pomodoroFinishedTaskId && !state.activeTaskId) {
    return null;
  }

  return {
    taskId: state.activeTaskId,
    flowDate: state.activeFlowDate,
    status: state.status,
    timerMode: state.timerMode,
    pomodoroTargetS: state.pomodoroTargetSeconds,
    segmentWallStart: state.segmentWallStart,
    sessionSavedS: state.sessionSavedSeconds,
    pomodoroFinishedTaskId: state.pomodoroFinishedTaskId,
    pomodoroFinishedFlowDate: state.pomodoroFinishedFlowDate,
    pomodoroFinishedTargetS: state.pomodoroFinishedTargetSeconds,
  };
}

export async function saveTimerSegment(
  state: TimerState,
  durationOverrideS?: number
): Promise<void> {
  const segmentSeconds = durationOverrideS ?? currentSegmentSeconds(state);
  if (
    segmentSeconds <= 0 ||
    !state.segmentWallStart ||
    !state.activeTaskId ||
    !state.activeFlowDate
  ) {
    return;
  }

  const segmentStartMs = new Date(state.segmentWallStart).getTime();
  const endTime = new Date(segmentStartMs + segmentSeconds * 1000).toISOString();

  try {
    await fetch(
      "/api/entries",
      jsonRequestInit("POST", {
        taskId: state.activeTaskId,
        flowDate: state.activeFlowDate,
        startTime: state.segmentWallStart,
        endTime,
        durationS: segmentSeconds,
        source: "timer",
      })
    );
  } catch {
    // Saving is best-effort; the user can still correct the entry manually later.
  }
}

export async function fetchPriorSeconds(taskId: string): Promise<number> {
  try {
    const response = await fetchNoStore(
      `/api/entries?taskId=${encodeURIComponent(taskId)}`
    );
    if (!response.ok) return 0;
    const entries = (await response.json()) as Array<{ durationS: number | null }>;
    return entries.reduce((sum, entry) => sum + (entry.durationS ?? 0), 0);
  } catch {
    return 0;
  }
}

export function clearPersistedTimerSession() {
  void fetch("/api/timer/session", { method: "DELETE" }).catch(() => {});
}

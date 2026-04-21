import { NextResponse } from "next/server";
import {
  clearActiveTimerSession,
  getActiveTimerSession,
  saveActiveTimerSession,
  type ActiveTimerSession,
  type TimerSessionMode,
  type TimerSessionStatus,
} from "@/lib/db/queries";

const STATUSES: readonly TimerSessionStatus[] = ["idle", "running", "paused"];
const MODES: readonly TimerSessionMode[] = ["countup", "pomodoro"];

function asNullableString(v: unknown): string | null {
  if (v == null) return null;
  return typeof v === "string" ? v : null;
}

function asNullableInt(v: unknown): number | null {
  if (v == null) return null;
  return typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : null;
}

export async function GET() {
  const session = getActiveTimerSession();
  return NextResponse.json({ session });
}

export async function PUT(request: Request) {
  const body = (await request.json()) as Partial<ActiveTimerSession>;

  const status = STATUSES.includes(body.status as TimerSessionStatus)
    ? (body.status as TimerSessionStatus)
    : "idle";
  const timerMode = MODES.includes(body.timerMode as TimerSessionMode)
    ? (body.timerMode as TimerSessionMode)
    : "countup";

  saveActiveTimerSession({
    taskId: asNullableString(body.taskId),
    flowDate: asNullableString(body.flowDate),
    status,
    timerMode,
    pomodoroTargetS: asNullableInt(body.pomodoroTargetS),
    segmentWallStart: asNullableString(body.segmentWallStart),
    sessionSavedS: Math.max(asNullableInt(body.sessionSavedS) ?? 0, 0),
    pomodoroFinishedTaskId: asNullableString(body.pomodoroFinishedTaskId),
    pomodoroFinishedFlowDate: asNullableString(body.pomodoroFinishedFlowDate),
    pomodoroFinishedTargetS: asNullableInt(body.pomodoroFinishedTargetS),
  });

  return NextResponse.json({ success: true });
}

export async function DELETE() {
  clearActiveTimerSession();
  return NextResponse.json({ success: true });
}

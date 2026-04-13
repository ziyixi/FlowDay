import { NextResponse } from "next/server";
import {
  createTimeEntry,
  getEntriesByTaskAndDate,
  getEntriesByTask,
  getEntriesByDate,
} from "@/lib/db/queries";

export async function POST(request: Request) {
  const body = await request.json();
  const { taskId, flowDate, startTime, endTime, durationS, source } = body;

  if (!taskId || !flowDate || !startTime) {
    return NextResponse.json(
      { error: "taskId, flowDate, and startTime are required" },
      { status: 400 }
    );
  }

  const id = crypto.randomUUID();
  createTimeEntry({
    id,
    taskId,
    flowDate,
    startTime,
    endTime: endTime ?? null,
    durationS: durationS ?? null,
    source: source ?? "timer",
  });

  return NextResponse.json({ id, taskId, flowDate, startTime, endTime, durationS, source }, { status: 201 });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get("taskId");
  const date = searchParams.get("date");

  if (taskId && date) {
    return NextResponse.json(getEntriesByTaskAndDate(taskId, date));
  }
  if (taskId) {
    return NextResponse.json(getEntriesByTask(taskId));
  }
  if (date) {
    return NextResponse.json(getEntriesByDate(date));
  }

  return NextResponse.json(
    { error: "At least 'taskId' or 'date' query parameter is required" },
    { status: 400 }
  );
}

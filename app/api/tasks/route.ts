import { NextResponse } from "next/server";
import { getAllTasks, updateTaskEstimate, softDeleteTask, removeTaskFromFlows } from "@/lib/db/queries";

export async function GET() {
  return NextResponse.json(getAllTasks());
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const { taskId, estimatedMins } = body;

  if (typeof taskId !== "string") {
    return NextResponse.json({ error: "taskId required" }, { status: 400 });
  }

  const mins = estimatedMins === null || estimatedMins === "" ? null : Number(estimatedMins);
  if (mins !== null && (isNaN(mins) || mins < 0)) {
    return NextResponse.json({ error: "Invalid estimatedMins" }, { status: 400 });
  }

  updateTaskEstimate(taskId, mins);
  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const body = await request.json();
  const { taskId } = body;

  if (typeof taskId !== "string") {
    return NextResponse.json({ error: "taskId required" }, { status: 400 });
  }

  softDeleteTask(taskId);
  removeTaskFromFlows(taskId);
  return NextResponse.json({ success: true });
}

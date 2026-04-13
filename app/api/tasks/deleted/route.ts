import { NextResponse } from "next/server";
import { getDeletedTasks, restoreTask } from "@/lib/db/queries";

export async function GET() {
  return NextResponse.json(getDeletedTasks());
}

export async function POST(request: Request) {
  const body = await request.json();
  const { taskId } = body;

  if (typeof taskId !== "string") {
    return NextResponse.json({ error: "taskId required" }, { status: 400 });
  }

  restoreTask(taskId);
  return NextResponse.json({ success: true });
}

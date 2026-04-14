import { NextResponse } from "next/server";
import { getAllTasks, updateTaskEstimate, updateTaskTitle, softDeleteTask, removeTaskFromFlows, createLocalTask } from "@/lib/db/queries";

export async function GET() {
  return NextResponse.json(getAllTasks());
}

export async function POST(request: Request) {
  const body = await request.json();
  const { title, priority, dueDate, estimatedMins, labels, description } = body;

  if (typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const task = createLocalTask({
    title: title.trim(),
    priority: typeof priority === "number" ? priority : undefined,
    dueDate: typeof dueDate === "string" ? dueDate : undefined,
    estimatedMins: typeof estimatedMins === "number" ? estimatedMins : undefined,
    labels: Array.isArray(labels) ? labels : undefined,
    description: typeof description === "string" ? description : undefined,
  });

  return NextResponse.json(task, { status: 201 });
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const { taskId, estimatedMins, title } = body;

  if (typeof taskId !== "string") {
    return NextResponse.json({ error: "taskId required" }, { status: 400 });
  }

  if (typeof title === "string") {
    if (!title.trim()) {
      return NextResponse.json({ error: "title cannot be empty" }, { status: 400 });
    }
    updateTaskTitle(taskId, title.trim());
  }

  if ("estimatedMins" in body) {
    const mins = estimatedMins === null || estimatedMins === "" ? null : Number(estimatedMins);
    if (mins !== null && (isNaN(mins) || mins < 0)) {
      return NextResponse.json({ error: "Invalid estimatedMins" }, { status: 400 });
    }
    updateTaskEstimate(taskId, mins);
  }

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

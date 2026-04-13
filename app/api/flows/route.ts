import { NextResponse } from "next/server";
import {
  getAllFlows,
  setFlowTaskIds,
  getAllCompletedFlowTasks,
  addCompletedFlowTask,
  removeCompletedFlowTask,
} from "@/lib/db/queries";

export async function GET() {
  return NextResponse.json({
    flows: getAllFlows(),
    completedTasks: getAllCompletedFlowTasks(),
  });
}

export async function PUT(request: Request) {
  const body = await request.json();
  const { action, date, taskIds, taskId } = body as {
    action: string;
    date: string;
    taskIds?: string[];
    taskId?: string;
  };

  if (!date) {
    return NextResponse.json({ error: "date is required" }, { status: 400 });
  }

  switch (action) {
    case "setFlow":
      if (!Array.isArray(taskIds)) {
        return NextResponse.json({ error: "taskIds array required" }, { status: 400 });
      }
      setFlowTaskIds(date, taskIds);
      break;

    case "addCompleted":
      if (!taskId) {
        return NextResponse.json({ error: "taskId required" }, { status: 400 });
      }
      addCompletedFlowTask(date, taskId);
      break;

    case "removeCompleted":
      if (!taskId) {
        return NextResponse.json({ error: "taskId required" }, { status: 400 });
      }
      removeCompletedFlowTask(date, taskId);
      break;

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}

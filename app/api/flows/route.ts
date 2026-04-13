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

    case "rollover": {
      const { fromDate, toDate } = body as { fromDate?: string; toDate?: string };
      if (!fromDate || !toDate) {
        return NextResponse.json({ error: "fromDate and toDate required" }, { status: 400 });
      }
      const allFlows = getAllFlows();
      const allCompleted = getAllCompletedFlowTasks();
      const sourceTasks = allFlows[fromDate] ?? [];
      const completedSet = new Set(allCompleted[fromDate] ?? []);
      const incomplete = sourceTasks.filter((id) => !completedSet.has(id));
      if (incomplete.length === 0) break;

      // Prepend incomplete tasks to target date's flow (dedup)
      const existing = allFlows[toDate] ?? [];
      const existingSet = new Set(existing);
      const toAdd = incomplete.filter((id) => !existingSet.has(id));
      if (toAdd.length > 0) {
        setFlowTaskIds(toDate, [...toAdd, ...existing]);
      }
      // Remove rolled-over tasks from source flow
      const remaining = sourceTasks.filter((id) => completedSet.has(id) || !incomplete.includes(id));
      setFlowTaskIds(fromDate, remaining);
      break;
    }

    case "rolloverSelected": {
      const { fromDate, toDate, taskIds: selectedIds } = body as {
        fromDate?: string;
        toDate?: string;
        taskIds?: string[];
      };
      if (!fromDate || !toDate || !Array.isArray(selectedIds)) {
        return NextResponse.json(
          { error: "fromDate, toDate, and taskIds required" },
          { status: 400 }
        );
      }
      const selectedSet = new Set(selectedIds);
      const allFlowsS = getAllFlows();
      const sourceTasksS = allFlowsS[fromDate] ?? [];

      const toMoveS = sourceTasksS.filter((id) => selectedSet.has(id));
      if (toMoveS.length === 0) break;

      // Prepend selected tasks to target (dedup)
      const existingS = allFlowsS[toDate] ?? [];
      const existingSetS = new Set(existingS);
      const toAddS = toMoveS.filter((id) => !existingSetS.has(id));
      if (toAddS.length > 0) {
        setFlowTaskIds(toDate, [...toAddS, ...existingS]);
      }
      // Remove moved tasks from source
      const remainingS = sourceTasksS.filter((id) => !selectedSet.has(id));
      setFlowTaskIds(fromDate, remainingS);
      break;
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}

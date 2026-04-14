import { NextResponse } from "next/server";
import {
  getEntriesInDateRange,
  getFlowTaskIdsInDateRange,
  getCompletedTaskIdsInDateRange,
  getTasksByIds,
} from "@/lib/db/queries";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fmt = searchParams.get("format") ?? "csv";
  const type = searchParams.get("type") ?? "entries";
  const startDate = searchParams.get("start");
  const endDate = searchParams.get("end");

  if (!startDate || !endDate) {
    return NextResponse.json(
      { error: "start and end date params required" },
      { status: 400 }
    );
  }

  if (!["csv", "json"].includes(fmt)) {
    return NextResponse.json({ error: "format must be csv or json" }, { status: 400 });
  }

  if (type === "entries") {
    return exportEntries(startDate, endDate, fmt);
  }
  if (type === "flows") {
    return exportFlows(startDate, endDate, fmt);
  }

  return NextResponse.json({ error: "type must be entries or flows" }, { status: 400 });
}

function escapeCsvField(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function exportEntries(startDate: string, endDate: string, fmt: string) {
  const entries = getEntriesInDateRange(startDate, endDate);
  const taskIds = [...new Set(entries.map((e) => e.taskId))];
  const taskMap = new Map(getTasksByIds(taskIds).map((t) => [t.id, t]));

  const rows = entries.map((e) => ({
    date: e.flowDate,
    taskId: e.taskId,
    taskTitle: taskMap.get(e.taskId)?.title ?? "Unknown",
    project: taskMap.get(e.taskId)?.projectName ?? "",
    startTime: e.startTime,
    endTime: e.endTime ?? "",
    durationMins: e.durationS ? Math.round(e.durationS / 60) : 0,
    source: e.source,
  }));

  if (fmt === "json") {
    return NextResponse.json(rows);
  }

  const headers = ["date", "taskId", "taskTitle", "project", "startTime", "endTime", "durationMins", "source"] as const;
  const csvLines = [
    headers.join(","),
    ...rows.map((r) =>
      headers.map((h) => escapeCsvField(String(r[h]))).join(",")
    ),
  ];

  return new Response(csvLines.join("\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="flowday-entries-${startDate}-to-${endDate}.csv"`,
    },
  });
}

function exportFlows(startDate: string, endDate: string, fmt: string) {
  const flowEntries = getFlowTaskIdsInDateRange(startDate, endDate);
  const completedEntries = getCompletedTaskIdsInDateRange(startDate, endDate);
  const entries = getEntriesInDateRange(startDate, endDate);

  const allTaskIds = [...new Set([
    ...flowEntries.map((e) => e.taskId),
    ...completedEntries.map((e) => e.taskId),
  ])];
  const taskMap = new Map(getTasksByIds(allTaskIds).map((t) => [t.id, t]));

  const completedByDate = new Map<string, Set<string>>();
  for (const e of completedEntries) {
    if (!completedByDate.has(e.flowDate)) completedByDate.set(e.flowDate, new Set());
    completedByDate.get(e.flowDate)!.add(e.taskId);
  }

  const timeByTaskDate = new Map<string, number>();
  for (const e of entries) {
    const key = `${e.flowDate}:${e.taskId}`;
    timeByTaskDate.set(key, (timeByTaskDate.get(key) ?? 0) + (e.durationS ?? 0));
  }

  const rows = flowEntries.map((entry) => {
    const task = taskMap.get(entry.taskId);
    const completed = completedByDate.get(entry.flowDate)?.has(entry.taskId) ?? false;
    const loggedSecs = timeByTaskDate.get(`${entry.flowDate}:${entry.taskId}`) ?? 0;
    return {
      date: entry.flowDate,
      taskId: entry.taskId,
      taskTitle: task?.title ?? "Unknown",
      project: task?.projectName ?? "",
      estimatedMins: task?.estimatedMins ?? 0,
      loggedMins: Math.round(loggedSecs / 60),
      completed,
    };
  });

  if (fmt === "json") {
    return NextResponse.json(rows);
  }

  const headers = ["date", "taskId", "taskTitle", "project", "estimatedMins", "loggedMins", "completed"] as const;
  const csvLines = [
    headers.join(","),
    ...rows.map((r) =>
      headers.map((h) => escapeCsvField(String(r[h]))).join(",")
    ),
  ];

  return new Response(csvLines.join("\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="flowday-flows-${startDate}-to-${endDate}.csv"`,
    },
  });
}

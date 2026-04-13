import { NextResponse } from "next/server";
import { startOfWeek, endOfWeek, format, eachDayOfInterval, parseISO } from "date-fns";
import {
  getEntriesInDateRange,
  getFlowTaskIdsInDateRange,
  getCompletedTaskIdsInDateRange,
  getTasksByIds,
  getSetting,
  getAllTimeEntries,
} from "@/lib/db/queries";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const date = searchParams.get("date");

  if (type === "stats") {
    return NextResponse.json(computeWorkPatternStats());
  }

  if (!type || !date) {
    return NextResponse.json({ error: "type and date required" }, { status: 400 });
  }

  if (type === "daily") {
    return NextResponse.json(computeDailyAnalytics(date));
  }

  if (type === "weekly") {
    return NextResponse.json(computeWeeklyAnalytics(date));
  }

  return NextResponse.json({ error: "Invalid type" }, { status: 400 });
}

function computeDailyAnalytics(date: string) {
  const flowEntries = getFlowTaskIdsInDateRange(date, date);
  const completedEntries = getCompletedTaskIdsInDateRange(date, date);
  const timeEntryRows = getEntriesInDateRange(date, date);
  const capacityStr = getSetting("day_capacity_mins");
  const dayCapacityMins = capacityStr ? parseInt(capacityStr, 10) : 360;

  const allTaskIds = [
    ...new Set([
      ...flowEntries.map((r) => r.taskId),
      ...completedEntries.map((r) => r.taskId),
    ]),
  ];
  const taskMap = new Map(getTasksByIds(allTaskIds).map((t) => [t.id, t]));
  const completedSet = new Set(completedEntries.map((r) => r.taskId));

  // Aggregate time per task
  const timeByTask = new Map<string, number>();
  for (const entry of timeEntryRows) {
    const secs = entry.durationS ?? 0;
    timeByTask.set(entry.taskId, (timeByTask.get(entry.taskId) ?? 0) + secs);
  }

  const tasks = allTaskIds.map((id) => {
    const task = taskMap.get(id);
    return {
      id,
      title: task?.title ?? "Unknown",
      projectName: task?.projectName ?? null,
      projectColor: task?.projectColor ?? null,
      estimatedMins: task?.estimatedMins ?? null,
      loggedMins: Math.round((timeByTask.get(id) ?? 0) / 60),
      completed: completedSet.has(id),
    };
  });

  const totalEstimatedMins = tasks.reduce((s, t) => s + (t.estimatedMins ?? 0), 0);
  const totalLoggedMins = tasks.reduce((s, t) => s + t.loggedMins, 0);

  // Hourly distribution for this day (0-23)
  const hourlyMins = new Array(24).fill(0);
  for (const entry of timeEntryRows) {
    if (!entry.startTime || !entry.durationS) continue;
    const start = new Date(entry.startTime);
    const endTime = entry.endTime ? new Date(entry.endTime) : new Date(start.getTime() + entry.durationS * 1000);
    // Distribute seconds across hours
    let cursor = new Date(start);
    while (cursor < endTime) {
      const hour = cursor.getHours();
      const nextHour = new Date(cursor);
      nextHour.setMinutes(0, 0, 0);
      nextHour.setHours(hour + 1);
      const sliceEnd = nextHour < endTime ? nextHour : endTime;
      const secsInSlice = (sliceEnd.getTime() - cursor.getTime()) / 1000;
      hourlyMins[hour] += secsInSlice / 60;
      cursor = sliceEnd;
    }
  }

  return {
    date,
    tasksPlanned: allTaskIds.length,
    tasksCompleted: completedSet.size,
    totalEstimatedMins,
    totalLoggedMins,
    dayCapacityMins,
    tasks,
    hourlyMins: hourlyMins.map((m) => Math.round(m)),
  };
}

function computeWeeklyAnalytics(date: string) {
  const targetDate = parseISO(date);
  const weekStart = startOfWeek(targetDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(targetDate, { weekStartsOn: 1 });
  const startStr = format(weekStart, "yyyy-MM-dd");
  const endStr = format(weekEnd, "yyyy-MM-dd");

  const allFlowEntries = getFlowTaskIdsInDateRange(startStr, endStr);
  const allCompletedEntries = getCompletedTaskIdsInDateRange(startStr, endStr);
  const allTimeEntries = getEntriesInDateRange(startStr, endStr);

  const allTaskIds = [
    ...new Set([
      ...allFlowEntries.map((r) => r.taskId),
      ...allCompletedEntries.map((r) => r.taskId),
    ]),
  ];
  const taskMap = new Map(getTasksByIds(allTaskIds).map((t) => [t.id, t]));

  // --- Per-day summary ---
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd }).map((d) => {
    const dateStr = format(d, "yyyy-MM-dd");
    const planned = new Set([
      ...allFlowEntries.filter((r) => r.flowDate === dateStr).map((r) => r.taskId),
      ...allCompletedEntries.filter((r) => r.flowDate === dateStr).map((r) => r.taskId),
    ]);
    const completed = allCompletedEntries.filter((r) => r.flowDate === dateStr);
    const loggedSecs = allTimeEntries
      .filter((e) => e.flowDate === dateStr)
      .reduce((s, e) => s + (e.durationS ?? 0), 0);
    return {
      date: dateStr,
      dayOfWeek: format(d, "EEE"),
      tasksPlanned: planned.size,
      tasksCompleted: completed.length,
      loggedMins: Math.round(loggedSecs / 60),
    };
  });

  // --- By project ---
  const projectMap = new Map<
    string,
    { loggedSecs: number; completed: Set<string>; color: string | null }
  >();
  for (const entry of allTimeEntries) {
    const task = taskMap.get(entry.taskId);
    const project = task?.projectName ?? "No Project";
    const color = task?.projectColor ?? null;
    if (!projectMap.has(project)) {
      projectMap.set(project, { loggedSecs: 0, completed: new Set(), color });
    }
    projectMap.get(project)!.loggedSecs += entry.durationS ?? 0;
  }
  for (const entry of allCompletedEntries) {
    const task = taskMap.get(entry.taskId);
    const project = task?.projectName ?? "No Project";
    const color = task?.projectColor ?? null;
    if (!projectMap.has(project)) {
      projectMap.set(project, { loggedSecs: 0, completed: new Set(), color });
    }
    projectMap.get(project)!.completed.add(entry.taskId);
  }
  const byProject = Array.from(projectMap.entries())
    .map(([name, data]) => ({
      projectName: name,
      projectColor: data.color,
      loggedMins: Math.round(data.loggedSecs / 60),
      tasksCompleted: data.completed.size,
    }))
    .sort((a, b) => b.loggedMins - a.loggedMins);

  // --- Stuck tasks: appeared on 2+ dates, never completed ---
  const taskDates = new Map<string, Set<string>>();
  for (const entry of allFlowEntries) {
    if (!taskDates.has(entry.taskId)) taskDates.set(entry.taskId, new Set());
    taskDates.get(entry.taskId)!.add(entry.flowDate);
  }
  const completedTaskIds = new Set(allCompletedEntries.map((r) => r.taskId));
  const stuckTasks = Array.from(taskDates.entries())
    .filter(([taskId, dates]) => dates.size >= 2 && !completedTaskIds.has(taskId))
    .map(([taskId, dates]) => {
      const task = taskMap.get(taskId);
      return {
        id: taskId,
        title: task?.title ?? "Unknown",
        daysAppeared: dates.size,
        dates: Array.from(dates).sort(),
      };
    })
    .sort((a, b) => b.daysAppeared - a.daysAppeared);

  // --- Estimation accuracy (completed tasks with both estimate + logged time) ---
  const seenTaskIds = new Set<string>();
  const estimationAccuracy = allCompletedEntries
    .filter((r) => {
      if (seenTaskIds.has(r.taskId)) return false;
      seenTaskIds.add(r.taskId);
      return true;
    })
    .map((r) => {
      const task = taskMap.get(r.taskId);
      if (!task || task.estimatedMins == null || task.estimatedMins <= 0) return null;
      const loggedSecs = allTimeEntries
        .filter((e) => e.taskId === r.taskId)
        .reduce((s, e) => s + (e.durationS ?? 0), 0);
      if (loggedSecs === 0) return null;
      return {
        id: r.taskId,
        title: task.title,
        estimatedMins: task.estimatedMins,
        actualMins: Math.round(loggedSecs / 60),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x != null);

  // Overall accuracy
  let overallAccuracy: number | null = null;
  if (estimationAccuracy.length > 0) {
    const sum = estimationAccuracy.reduce((s, item) => {
      const ratio =
        Math.min(item.estimatedMins, item.actualMins) /
        Math.max(item.estimatedMins, item.actualMins);
      return s + ratio;
    }, 0);
    overallAccuracy = Math.round((sum / estimationAccuracy.length) * 100);
  }

  // --- Work time heatmap: 7 days × 24 hours ---
  // heatmap[dayIndex][hour] = minutes
  const heatmap: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));
  for (const entry of allTimeEntries) {
    if (!entry.startTime || !entry.durationS) continue;
    const start = new Date(entry.startTime);
    const endTime = entry.endTime ? new Date(entry.endTime) : new Date(start.getTime() + entry.durationS * 1000);
    // day index: 0=Mon, 6=Sun
    let cursor = new Date(start);
    while (cursor < endTime) {
      const jsDay = cursor.getDay(); // 0=Sun
      const dayIdx = jsDay === 0 ? 6 : jsDay - 1; // convert to 0=Mon
      const hour = cursor.getHours();
      const nextHour = new Date(cursor);
      nextHour.setMinutes(0, 0, 0);
      nextHour.setHours(hour + 1);
      const sliceEnd = nextHour < endTime ? nextHour : endTime;
      const secsInSlice = (sliceEnd.getTime() - cursor.getTime()) / 1000;
      heatmap[dayIdx][hour] += secsInSlice / 60;
      cursor = sliceEnd;
    }
  }

  // --- Totals ---
  const totalCompleted = new Set(allCompletedEntries.map((r) => r.taskId)).size;
  const totalLoggedMins = Math.round(
    allTimeEntries.reduce((s, e) => s + (e.durationS ?? 0), 0) / 60
  );
  const activeDays = days.filter((d) => d.tasksPlanned > 0).length;

  return {
    weekStart: startStr,
    weekEnd: endStr,
    days,
    byProject,
    stuckTasks,
    estimationAccuracy,
    heatmap: heatmap.map((row) => row.map((m) => Math.round(m))),
    totals: {
      tasksCompleted: totalCompleted,
      totalLoggedMins,
      avgTasksPerDay:
        activeDays > 0 ? Math.round((totalCompleted / activeDays) * 10) / 10 : 0,
      overallAccuracy,
    },
  };
}

function computeWorkPatternStats() {
  const allEntries = getAllTimeEntries();

  // Count how many distinct weeks had work in each (dayOfWeek, hour) slot
  // heatmap[dayIdx][hour] = number of weeks with work in that slot
  // Also track total minutes per slot for intensity

  // First, group entries by ISO week key + dayIdx + hour
  const weekSlotSets = new Map<string, Set<string>>(); // "dayIdx-hour" -> Set<weekKey>
  const totalMins: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));

  for (const entry of allEntries) {
    if (!entry.startTime || !entry.durationS) continue;
    const start = new Date(entry.startTime);
    const endTime = entry.endTime
      ? new Date(entry.endTime)
      : new Date(start.getTime() + entry.durationS * 1000);

    // Week key from flowDate to group by week
    const weekKey = entry.flowDate.slice(0, 10); // yyyy-mm-dd
    const weekStart = format(
      startOfWeek(parseISO(weekKey), { weekStartsOn: 1 }),
      "yyyy-MM-dd"
    );

    let cursor = new Date(start);
    while (cursor < endTime) {
      const jsDay = cursor.getDay();
      const dayIdx = jsDay === 0 ? 6 : jsDay - 1;
      const hour = cursor.getHours();

      const nextHour = new Date(cursor);
      nextHour.setMinutes(0, 0, 0);
      nextHour.setHours(hour + 1);
      const sliceEnd = nextHour < endTime ? nextHour : endTime;
      const secsInSlice = (sliceEnd.getTime() - cursor.getTime()) / 1000;

      const slotKey = `${dayIdx}-${hour}`;
      if (!weekSlotSets.has(slotKey)) weekSlotSets.set(slotKey, new Set());
      weekSlotSets.get(slotKey)!.add(weekStart);
      totalMins[dayIdx][hour] += secsInSlice / 60;

      cursor = sliceEnd;
    }
  }

  // Build count grid (how many weeks had work in this slot)
  const weekCount: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));
  for (const [slotKey, weeks] of weekSlotSets) {
    const [dayIdx, hour] = slotKey.split("-").map(Number);
    weekCount[dayIdx][hour] = weeks.size;
  }

  // Count total distinct weeks
  const allWeeks = new Set<string>();
  for (const weeks of weekSlotSets.values()) {
    for (const w of weeks) allWeeks.add(w);
  }

  return {
    weekCount: weekCount.map((row) => row.map((c) => c)),
    totalMins: totalMins.map((row) => row.map((m) => Math.round(m))),
    totalWeeks: allWeeks.size,
  };
}

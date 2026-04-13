import { eq, and, notInArray, isNotNull } from "drizzle-orm";
import { getDb } from "./index";
import { timeEntries, tasks, settings, flowTasks, completedFlowTasks } from "./schema";
import type { Task, TaskPriority } from "@/lib/types/task";

export interface TimeEntryRow {
  id: string;
  taskId: string;
  flowDate: string;
  startTime: string;
  endTime: string | null;
  durationS: number | null;
  source: string;
  createdAt: string | null;
}

export function createTimeEntry(entry: {
  id: string;
  taskId: string;
  flowDate: string;
  startTime: string;
  endTime: string | null;
  durationS: number | null;
  source: "timer" | "manual";
}): void {
  const db = getDb();
  db.insert(timeEntries).values(entry).run();
}

export function updateTimeEntry(
  id: string,
  updates: { startTime: string; endTime: string; durationS: number }
): boolean {
  const db = getDb();
  const result = db
    .update(timeEntries)
    .set(updates)
    .where(eq(timeEntries.id, id))
    .run();
  return result.changes > 0;
}

export function getEntriesByTaskAndDate(
  taskId: string,
  flowDate: string
): TimeEntryRow[] {
  const db = getDb();
  return db
    .select()
    .from(timeEntries)
    .where(and(eq(timeEntries.taskId, taskId), eq(timeEntries.flowDate, flowDate)))
    .all() as TimeEntryRow[];
}

export function getEntriesByTask(taskId: string): TimeEntryRow[] {
  const db = getDb();
  return db
    .select()
    .from(timeEntries)
    .where(eq(timeEntries.taskId, taskId))
    .all() as TimeEntryRow[];
}

export function getEntriesByDate(flowDate: string): TimeEntryRow[] {
  const db = getDb();
  return db
    .select()
    .from(timeEntries)
    .where(eq(timeEntries.flowDate, flowDate))
    .all() as TimeEntryRow[];
}

export function deleteTimeEntry(id: string): boolean {
  const db = getDb();
  const result = db.delete(timeEntries).where(eq(timeEntries.id, id)).run();
  return result.changes > 0;
}

// ---- Settings ----

export function getSetting(key: string): string | null {
  const db = getDb();
  const row = db.select().from(settings).where(eq(settings.key, key)).get();
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  const db = getDb();
  db.insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } })
    .run();
}

// ---- Tasks ----

function rowToTask(row: {
  id: string;
  todoistId: string | null;
  title: string;
  projectName: string | null;
  projectColor: string | null;
  priority: number;
  labels: string | null;
  estimatedMins: number | null;
  isCompleted: number;
  completedAt: string | null;
  dueDate: string | null;
  createdAt: string | null;
  syncedAt: string | null;
}): Task {
  return {
    id: row.id,
    todoistId: row.todoistId,
    title: row.title,
    projectName: row.projectName,
    projectColor: row.projectColor,
    priority: (row.priority as TaskPriority) || 1,
    labels: JSON.parse(row.labels || "[]"),
    estimatedMins: row.estimatedMins,
    isCompleted: row.isCompleted === 1,
    completedAt: row.completedAt,
    dueDate: row.dueDate,
    createdAt: row.createdAt || new Date().toISOString(),
  };
}

export function getAllTasks(): Task[] {
  const db = getDb();
  const rows = db.select().from(tasks).all();
  return rows.map(rowToTask);
}

export function upsertTasks(taskList: Task[]): void {
  const db = getDb();
  const now = new Date().toISOString();
  const rawDb = (db as unknown as { $client: { transaction: (fn: () => void) => void } }).$client;

  rawDb.transaction(() => {
    for (const t of taskList) {
      db.insert(tasks)
        .values({
          id: t.id,
          todoistId: t.todoistId,
          title: t.title,
          projectName: t.projectName,
          projectColor: t.projectColor,
          priority: t.priority,
          labels: JSON.stringify(t.labels),
          estimatedMins: t.estimatedMins,
          isCompleted: t.isCompleted ? 1 : 0,
          completedAt: t.completedAt,
          dueDate: t.dueDate,
          createdAt: t.createdAt,
          syncedAt: now,
        })
        .onConflictDoUpdate({
          target: tasks.id,
          set: {
            todoistId: t.todoistId,
            title: t.title,
            projectName: t.projectName,
            projectColor: t.projectColor,
            priority: t.priority,
            labels: JSON.stringify(t.labels),
            estimatedMins: t.estimatedMins,
            isCompleted: t.isCompleted ? 1 : 0,
            completedAt: t.completedAt,
            dueDate: t.dueDate,
            syncedAt: now,
          },
        })
        .run();
    }
  });
}

export function deleteStaleTasksNotIn(ids: string[]): void {
  if (ids.length === 0) return;
  const db = getDb();

  // Collect task IDs still referenced by flows or completed flows — these must be preserved
  const flowRefs = db.select({ taskId: flowTasks.taskId }).from(flowTasks).all();
  const completedRefs = db.select({ taskId: completedFlowTasks.taskId }).from(completedFlowTasks).all();
  const referencedIds = new Set([
    ...ids,
    ...flowRefs.map((r) => r.taskId),
    ...completedRefs.map((r) => r.taskId),
  ]);

  // Only delete Todoist-synced tasks that are NOT in the API AND not referenced by any flow
  const safeIds = Array.from(referencedIds);
  db.delete(tasks)
    .where(and(notInArray(tasks.id, safeIds), isNotNull(tasks.todoistId)))
    .run();
}

// ---- Flow tasks ----

export function getAllFlows(): Record<string, string[]> {
  const db = getDb();
  const rows = db.select().from(flowTasks).orderBy(flowTasks.sortOrder).all();
  const result: Record<string, string[]> = {};
  for (const row of rows) {
    if (!result[row.flowDate]) result[row.flowDate] = [];
    result[row.flowDate].push(row.taskId);
  }
  return result;
}

export function setFlowTaskIds(flowDate: string, taskIds: string[]): void {
  const db = getDb();
  const rawDb = (db as unknown as { $client: { transaction: (fn: () => void) => void } }).$client;

  rawDb.transaction(() => {
    db.delete(flowTasks).where(eq(flowTasks.flowDate, flowDate)).run();
    for (let i = 0; i < taskIds.length; i++) {
      db.insert(flowTasks)
        .values({
          id: crypto.randomUUID(),
          flowDate,
          taskId: taskIds[i],
          sortOrder: i,
        })
        .run();
    }
  });
}

// ---- Completed flow tasks ----

export function getAllCompletedFlowTasks(): Record<string, string[]> {
  const db = getDb();
  const rows = db.select().from(completedFlowTasks).all();
  const result: Record<string, string[]> = {};
  for (const row of rows) {
    if (!result[row.flowDate]) result[row.flowDate] = [];
    result[row.flowDate].push(row.taskId);
  }
  return result;
}

export function addCompletedFlowTask(flowDate: string, taskId: string): void {
  const db = getDb();
  db.insert(completedFlowTasks)
    .values({ id: crypto.randomUUID(), flowDate, taskId })
    .onConflictDoNothing()
    .run();
}

export function removeCompletedFlowTask(flowDate: string, taskId: string): void {
  const db = getDb();
  db.delete(completedFlowTasks)
    .where(and(eq(completedFlowTasks.flowDate, flowDate), eq(completedFlowTasks.taskId, taskId)))
    .run();
}

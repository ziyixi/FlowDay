import { eq, and, sql, isNull, isNotNull, gte, lte, inArray } from "drizzle-orm";
import { getDb } from "./index";
import { timeEntries, tasks, settings, flowTasks, completedFlowTasks, flowTaskNotes } from "./schema";
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
  description: string | null;
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
  deletedAt: string | null;
}): Task {
  return {
    id: row.id,
    todoistId: row.todoistId,
    title: row.title,
    description: row.description,
    projectName: row.projectName,
    projectColor: row.projectColor,
    priority: (row.priority as TaskPriority) || 1,
    labels: JSON.parse(row.labels || "[]"),
    estimatedMins: row.estimatedMins,
    isCompleted: row.isCompleted === 1,
    completedAt: row.completedAt,
    dueDate: row.dueDate,
    createdAt: row.createdAt || new Date().toISOString(),
    deletedAt: row.deletedAt ?? null,
  };
}

export function getAllTasks(): Task[] {
  const db = getDb();
  const rows = db.select().from(tasks).where(isNull(tasks.deletedAt)).all();
  return rows.map(rowToTask);
}

export function getDeletedTasks(): Task[] {
  const db = getDb();
  const rows = db.select().from(tasks).where(isNotNull(tasks.deletedAt)).all();
  return rows.map(rowToTask);
}

export function softDeleteTask(taskId: string): boolean {
  const db = getDb();
  const result = db
    .update(tasks)
    .set({ deletedAt: new Date().toISOString() })
    .where(eq(tasks.id, taskId))
    .run();
  return result.changes > 0;
}

export function restoreTask(taskId: string): boolean {
  const db = getDb();
  const result = db
    .update(tasks)
    .set({ deletedAt: null })
    .where(eq(tasks.id, taskId))
    .run();
  return result.changes > 0;
}

export function removeTaskFromFlows(taskId: string): void {
  const db = getDb();
  db.delete(flowTasks).where(eq(flowTasks.taskId, taskId)).run();
  db.delete(completedFlowTasks).where(eq(completedFlowTasks.taskId, taskId)).run();
}

export function updateTaskEstimate(taskId: string, estimatedMins: number | null): boolean {
  const db = getDb();
  const result = db
    .update(tasks)
    .set({ estimatedMins })
    .where(eq(tasks.id, taskId))
    .run();
  return result.changes > 0;
}

export function updateTaskTitle(taskId: string, title: string): boolean {
  const db = getDb();
  const result = db
    .update(tasks)
    .set({ title })
    .where(eq(tasks.id, taskId))
    .run();
  return result.changes > 0;
}

export function upsertTasks(taskList: Task[]): void {
  const db = getDb();
  const now = new Date().toISOString();
  const rawDb = (db as unknown as { $client: { transaction: (fn: () => void) => () => void } }).$client;

  const runTx = rawDb.transaction(() => {
    for (const t of taskList) {
      db.insert(tasks)
        .values({
          id: t.id,
          todoistId: t.todoistId,
          title: t.title,
          description: t.description,
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
            description: t.description,
            projectName: t.projectName,
            projectColor: t.projectColor,
            priority: t.priority,
            labels: JSON.stringify(t.labels),
            // Preserve local estimate when Todoist has no duration;
            // if Todoist provides one, it takes precedence
            estimatedMins: t.estimatedMins != null
              ? t.estimatedMins
              : sql`${tasks.estimatedMins}`,
            isCompleted: t.isCompleted ? 1 : 0,
            completedAt: t.completedAt,
            dueDate: t.dueDate,
            syncedAt: now,
            // Preserve soft-delete status across syncs
            deletedAt: sql`${tasks.deletedAt}`,
          },
        })
        .run();
    }
  });
  runTx();
}

export function createLocalTask(input: {
  title: string;
  priority?: number;
  dueDate?: string;
  estimatedMins?: number;
  labels?: string[];
  description?: string;
}): Task {
  const db = getDb();
  const id = `local-${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  db.insert(tasks)
    .values({
      id,
      todoistId: null,
      title: input.title,
      description: input.description ?? null,
      projectName: null,
      projectColor: null,
      priority: input.priority ?? 1,
      labels: JSON.stringify(input.labels ?? []),
      estimatedMins: input.estimatedMins ?? null,
      isCompleted: 0,
      completedAt: null,
      dueDate: input.dueDate ?? null,
      createdAt: now,
      syncedAt: null,
      deletedAt: null,
    })
    .run();
  return {
    id,
    todoistId: null,
    title: input.title,
    description: input.description ?? null,
    projectName: null,
    projectColor: null,
    priority: (input.priority ?? 1) as TaskPriority,
    labels: input.labels ?? [],
    estimatedMins: input.estimatedMins ?? null,
    isCompleted: false,
    completedAt: null,
    dueDate: input.dueDate ?? null,
    createdAt: now,
    deletedAt: null,
  };
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
  const rawDb = (db as unknown as { $client: { transaction: (fn: () => void) => () => void } }).$client;

  const runTx = rawDb.transaction(() => {
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
  runTx();
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

// ---- Flow task notes ----

export interface FlowTaskNoteRow {
  id: string;
  taskId: string;
  flowDate: string;
  content: string;
  updatedAt: string | null;
}

export function getNote(taskId: string, flowDate: string): FlowTaskNoteRow | null {
  const db = getDb();
  const row = db
    .select()
    .from(flowTaskNotes)
    .where(and(eq(flowTaskNotes.taskId, taskId), eq(flowTaskNotes.flowDate, flowDate)))
    .get();
  return (row as FlowTaskNoteRow | undefined) ?? null;
}

export function getNotesByDate(flowDate: string): FlowTaskNoteRow[] {
  const db = getDb();
  return db
    .select()
    .from(flowTaskNotes)
    .where(eq(flowTaskNotes.flowDate, flowDate))
    .all() as FlowTaskNoteRow[];
}

export function upsertNote(taskId: string, flowDate: string, content: string): FlowTaskNoteRow {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  db.insert(flowTaskNotes)
    .values({ id, taskId, flowDate, content, updatedAt: now })
    .onConflictDoUpdate({
      target: [flowTaskNotes.taskId, flowTaskNotes.flowDate],
      set: { content, updatedAt: now },
    })
    .run();
  return getNote(taskId, flowDate)!;
}

// ---- Analytics queries ----

export function getEntriesInDateRange(startDate: string, endDate: string): TimeEntryRow[] {
  const db = getDb();
  return db
    .select()
    .from(timeEntries)
    .where(and(gte(timeEntries.flowDate, startDate), lte(timeEntries.flowDate, endDate)))
    .all() as TimeEntryRow[];
}

export function getFlowTaskIdsInDateRange(
  startDate: string,
  endDate: string
): { flowDate: string; taskId: string }[] {
  const db = getDb();
  return db
    .select({ flowDate: flowTasks.flowDate, taskId: flowTasks.taskId })
    .from(flowTasks)
    .where(and(gte(flowTasks.flowDate, startDate), lte(flowTasks.flowDate, endDate)))
    .all();
}

export function getCompletedTaskIdsInDateRange(
  startDate: string,
  endDate: string
): { flowDate: string; taskId: string }[] {
  const db = getDb();
  return db
    .select({ flowDate: completedFlowTasks.flowDate, taskId: completedFlowTasks.taskId })
    .from(completedFlowTasks)
    .where(
      and(
        gte(completedFlowTasks.flowDate, startDate),
        lte(completedFlowTasks.flowDate, endDate)
      )
    )
    .all();
}

export function getTasksByIds(ids: string[]): Task[] {
  if (ids.length === 0) return [];
  const db = getDb();
  const rows = db.select().from(tasks).where(inArray(tasks.id, ids)).all();
  return rows.map(rowToTask);
}

export function getAllTimeEntries(): TimeEntryRow[] {
  const db = getDb();
  return db.select().from(timeEntries).all() as TimeEntryRow[];
}

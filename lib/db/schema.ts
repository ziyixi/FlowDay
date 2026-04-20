import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const timeEntries = sqliteTable("time_entries", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull(),
  flowDate: text("flow_date").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time"),
  durationS: integer("duration_s"),
  source: text("source").notNull().default("timer"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  todoistId: text("todoist_id"),
  title: text("title").notNull(),
  description: text("description"),
  projectName: text("project_name"),
  projectColor: text("project_color"),
  priority: integer("priority").notNull().default(1),
  labels: text("labels").default("[]"),
  estimatedMins: integer("estimated_mins"),
  isCompleted: integer("is_completed").notNull().default(0),
  completedAt: text("completed_at"),
  dueDate: text("due_date"),
  createdAt: text("created_at"),
  syncedAt: text("synced_at"),
  deletedAt: text("deleted_at"),
  // 'sync' = Todoist no longer returns this task; 'local' or null = user-initiated.
  // Sync-deleted tasks auto-restore if Todoist starts returning them again.
  deletedSource: text("deleted_source"),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value"),
});

export const flowTasks = sqliteTable("flow_tasks", {
  id: text("id").primaryKey(),
  flowDate: text("flow_date").notNull(),
  taskId: text("task_id").notNull(),
  sortOrder: integer("sort_order").notNull(),
});

export const completedFlowTasks = sqliteTable("completed_flow_tasks", {
  id: text("id").primaryKey(),
  flowDate: text("flow_date").notNull(),
  taskId: text("task_id").notNull(),
});

export const flowTaskNotes = sqliteTable("flow_task_notes", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull(),
  flowDate: text("flow_date").notNull(),
  content: text("content").notNull().default(""),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

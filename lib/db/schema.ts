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

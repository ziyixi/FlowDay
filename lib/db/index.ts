import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "node:path";
import fs from "node:fs";

const DB_PATH = path.join(process.cwd(), "db", "flowday.db");

const globalForDb = globalThis as unknown as {
  __flowdayDb?: ReturnType<typeof drizzle<typeof schema>>;
};

export function getDb() {
  if (globalForDb.__flowdayDb) return globalForDb.__flowdayDb;

  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS time_entries (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      flow_date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT,
      duration_s INTEGER,
      source TEXT NOT NULL DEFAULT 'timer',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      todoist_id TEXT,
      title TEXT NOT NULL,
      description TEXT,
      project_name TEXT,
      project_color TEXT,
      priority INTEGER NOT NULL DEFAULT 1,
      labels TEXT DEFAULT '[]',
      estimated_mins INTEGER,
      is_completed INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT,
      due_date TEXT,
      created_at TEXT,
      synced_at TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS flow_tasks (
      id TEXT PRIMARY KEY,
      flow_date TEXT NOT NULL,
      task_id TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      UNIQUE(flow_date, task_id)
    );

    CREATE TABLE IF NOT EXISTS completed_flow_tasks (
      id TEXT PRIMARY KEY,
      flow_date TEXT NOT NULL,
      task_id TEXT NOT NULL,
      UNIQUE(flow_date, task_id)
    );
  `);

  // Lightweight migrations: add columns that may not exist yet
  const cols = sqlite.pragma("table_info(tasks)") as { name: string }[];
  const colNames = new Set(cols.map((c) => c.name));
  if (!colNames.has("description")) {
    sqlite.exec("ALTER TABLE tasks ADD COLUMN description TEXT");
  }

  const db = drizzle(sqlite, { schema });
  globalForDb.__flowdayDb = db;
  return db;
}

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
  `);

  const db = drizzle(sqlite, { schema });
  globalForDb.__flowdayDb = db;
  return db;
}

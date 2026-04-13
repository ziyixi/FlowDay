import { NextResponse } from "next/server";
import { syncTodoistToDb } from "@/lib/todoist/sync";
import { getSetting } from "@/lib/db/queries";

export async function POST() {
  const apiKey = getSetting("todoist_api_key");
  if (!apiKey) {
    return NextResponse.json(
      { error: "No Todoist API key configured. Add one in Settings." },
      { status: 400 }
    );
  }

  try {
    const result = await syncTodoistToDb();
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ taskCount: result.taskCount, lastSyncAt: getSetting("last_sync_at") });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

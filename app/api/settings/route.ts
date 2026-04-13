import { NextResponse } from "next/server";
import { getSetting, setSetting } from "@/lib/db/queries";

export async function GET() {
  return NextResponse.json({
    todoist_api_key: getSetting("todoist_api_key") ? "••••••••" : null,
    has_api_key: !!getSetting("todoist_api_key"),
    last_sync_at: getSetting("last_sync_at"),
  });
}

export async function PUT(request: Request) {
  const body = await request.json();
  const { todoist_api_key } = body;

  if (typeof todoist_api_key !== "string" || !todoist_api_key.trim()) {
    return NextResponse.json({ error: "API key is required" }, { status: 400 });
  }

  setSetting("todoist_api_key", todoist_api_key.trim());
  return NextResponse.json({ success: true });
}

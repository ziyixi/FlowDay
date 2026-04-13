import { NextResponse } from "next/server";
import { getSetting, setSetting } from "@/lib/db/queries";

export async function GET() {
  const capacityRaw = getSetting("day_capacity_mins");
  return NextResponse.json({
    todoist_api_key: getSetting("todoist_api_key") ? "••••••••" : null,
    has_api_key: !!getSetting("todoist_api_key"),
    last_sync_at: getSetting("last_sync_at"),
    day_capacity_mins: capacityRaw != null ? Number(capacityRaw) : 360,
  });
}

export async function PUT(request: Request) {
  const body = await request.json();

  // Handle API key update
  if ("todoist_api_key" in body) {
    const { todoist_api_key } = body;
    if (typeof todoist_api_key !== "string" || !todoist_api_key.trim()) {
      return NextResponse.json({ error: "API key is required" }, { status: 400 });
    }
    setSetting("todoist_api_key", todoist_api_key.trim());
  }

  // Handle capacity update
  if ("day_capacity_mins" in body) {
    const mins = Number(body.day_capacity_mins);
    if (isNaN(mins) || mins < 0) {
      return NextResponse.json({ error: "Invalid capacity value" }, { status: 400 });
    }
    setSetting("day_capacity_mins", String(mins));
  }

  return NextResponse.json({ success: true });
}

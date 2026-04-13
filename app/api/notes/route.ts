import { NextResponse } from "next/server";
import { getNote, getNotesByDate, upsertNote } from "@/lib/db/queries";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get("taskId");
  const date = searchParams.get("date");

  if (taskId && date) {
    const note = getNote(taskId, date);
    return NextResponse.json(note ?? { taskId, flowDate: date, content: "" });
  }
  if (date) {
    return NextResponse.json(getNotesByDate(date));
  }

  return NextResponse.json({ error: "date query param required" }, { status: 400 });
}

export async function PUT(request: Request) {
  const body = await request.json();
  const { taskId, flowDate, content } = body as {
    taskId?: string;
    flowDate?: string;
    content?: string;
  };

  if (!taskId || !flowDate || typeof content !== "string") {
    return NextResponse.json(
      { error: "taskId, flowDate, and content are required" },
      { status: 400 }
    );
  }

  const note = upsertNote(taskId, flowDate, content);
  return NextResponse.json(note);
}

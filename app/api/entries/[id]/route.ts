import { NextResponse } from "next/server";
import { deleteTimeEntry, updateTimeEntry } from "@/lib/db/queries";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { startTime, endTime } = body;

  if (!startTime || !endTime) {
    return NextResponse.json(
      { error: "startTime and endTime are required" },
      { status: 400 }
    );
  }

  const durationS = Math.floor(
    (new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000
  );

  const updated = updateTimeEntry(id, { startTime, endTime, durationS });
  if (!updated) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }

  return NextResponse.json({ id, startTime, endTime, durationS });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deleted = deleteTimeEntry(id);
  if (!deleted) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

import { NextResponse } from "next/server";
import { getAllTasks } from "@/lib/db/queries";

export async function GET() {
  return NextResponse.json(getAllTasks());
}

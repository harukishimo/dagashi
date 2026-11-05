import { NextResponse } from "next/server";
import { readOperationSettings } from "@/application/operation-settings";
import { toAppError } from "@/lib/errors";

export async function GET() {
  try {
    return NextResponse.json({ data: await readOperationSettings() }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const appError = toAppError(error);
    return NextResponse.json(appError.toResponse(), { status: appError.status, headers: { "cache-control": "no-store" } });
  }
}

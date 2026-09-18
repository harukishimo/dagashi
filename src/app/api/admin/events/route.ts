import { NextResponse } from "next/server";
import { requireAdminSession, refreshAdminSessionCookie } from "@/application/admin/require-admin-session";
import { createGoogleEventsService } from "@/application/admin/events-service";
import { toAppError } from "@/lib/errors";

export async function GET(request: Request) {
  if (!(await requireAdminSession(request))) return NextResponse.json({ error: { message: "認証が必要です" } }, { status: 401 });
  try {
    return refreshAdminSessionCookie(request, NextResponse.json({ data: { events: await createGoogleEventsService().list() } }));
  } catch (error) { const appError = toAppError(error); return NextResponse.json(appError.toResponse(), { status: appError.status }); }
}
export async function POST(request: Request) {
  if (!(await requireAdminSession(request, { requireOrigin: true }))) return NextResponse.json({ error: { message: "認証が必要です" } }, { status: 401 });
  try {
    return refreshAdminSessionCookie(request, NextResponse.json({ data: { event: await createGoogleEventsService().create(await request.json()) } }, { status: 201 }));
  } catch (error) { const appError = toAppError(error); return NextResponse.json(appError.toResponse(), { status: appError.status }); }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession, refreshAdminSessionCookie } from "@/application/admin/require-admin-session";
import { createGoogleEventsService } from "@/application/admin/events-service";
import { toAppError } from "@/lib/errors";

export async function PATCH(request: Request, context: { params: Promise<{ eventId: string }> }) {
  if (!(await requireAdminSession(request, { requireOrigin: true }))) return NextResponse.json({ error: { message: "認証が必要です" } }, { status: 401 });
  try {
    z.object({ status: z.literal("archived") }).strict().parse(await request.json());
    const { eventId } = await context.params;
    await createGoogleEventsService().archive(eventId);
    return refreshAdminSessionCookie(request, NextResponse.json({ data: { archived: true } }));
  } catch (error) { const appError = toAppError(error); return NextResponse.json(appError.toResponse(), { status: appError.status }); }
}

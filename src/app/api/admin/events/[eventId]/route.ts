import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession, refreshAdminSessionCookie } from "@/application/admin/require-admin-session";
import { createGoogleEventsService } from "@/application/admin/events-service";
import { toAppError } from "@/lib/errors";
import { eventDetailsSchema } from "@/domain/events";

export async function PATCH(request: Request, context: { params: Promise<{ eventId: string }> }) {
  if (!(await requireAdminSession(request, { requireOrigin: true }))) return NextResponse.json({ error: { message: "認証が必要です" } }, { status: 401 });
  try {
    const body = z.union([z.object({ status: z.literal("archived") }).strict(), eventDetailsSchema]).parse(await request.json());
    const { eventId } = await context.params;
    const service = createGoogleEventsService();
    if ("status" in body) {
      await service.archive(eventId);
      return refreshAdminSessionCookie(request, NextResponse.json({ data: { archived: true } }));
    }
    return refreshAdminSessionCookie(request, NextResponse.json({ data: { details: await service.updateDetails(eventId, body) } }));
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: { message: "入力内容を確認してください", details: error.issues.map(issue => issue.message) } }, { status: 400 });
    const appError = toAppError(error); return NextResponse.json(appError.toResponse(), { status: appError.status });
  }
}

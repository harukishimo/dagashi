import { NextResponse } from "next/server";

import { refreshAdminSessionCookie, requireAdminSession } from "@/application/admin/require-admin-session";
import { createGoogleAdminService } from "@/application/admin/service";
import { AppError, toAppError } from "@/lib/errors";

interface RouteContext {
  params: Promise<{ saleId: string }>;
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  if (!(await requireAdminSession(request, { requireOrigin: true }))) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "認証が必要です" } }, { status: 401 });
  try {
    const body = (await request.json()) as { reason?: unknown };
    if (typeof body.reason !== "string") throw new AppError("VALIDATION_ERROR", { details: ["取消理由は必須です"] });
    const { saleId } = await context.params;
    return refreshAdminSessionCookie(request, NextResponse.json({ data: await createGoogleAdminService().voidSale(saleId, body.reason) }));
  } catch (error) {
    const appError = toAppError(error);
    return NextResponse.json(appError.toResponse(), { status: appError.status });
  }
}

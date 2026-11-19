import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAdminSession, refreshAdminSessionCookie } from "@/application/admin/require-admin-session";
import { createGoogleProductService } from "@/application/products/service";
import { AppError, toAppError } from "@/lib/errors";

export async function PATCH(request: Request): Promise<Response> {
  if (!(await requireAdminSession(request, { requireOrigin: true }))) return NextResponse.json({ error: { message: "認証が必要です" } }, { status: 401 });
  try {
    let body: unknown;
    try { body = await request.json(); } catch { throw new AppError("VALIDATION_ERROR"); }
    const result = await createGoogleProductService().updateStocks(body);
    return refreshAdminSessionCookie(request, NextResponse.json({ data: result }));
  } catch (error) {
    const appError = error instanceof ZodError ? new AppError("VALIDATION_ERROR", { message: "在庫は0〜999999の整数か空欄で入力してください" }) : toAppError(error);
    return NextResponse.json(appError.toResponse(), { status: appError.status });
  }
}

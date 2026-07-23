import { NextResponse } from "next/server";

import { refreshAdminSessionCookie, requireAdminSession } from "@/application/admin/require-admin-session";
import { createGoogleAdminService } from "@/application/admin/service";
import { toAppError } from "@/lib/errors";

export async function GET(request: Request): Promise<Response> {
  if (!(await requireAdminSession(request))) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "認証が必要です" } }, { status: 401 });
  try {
    const params = new URL(request.url).searchParams;
    return refreshAdminSessionCookie(request, NextResponse.json({ data: await createGoogleAdminService().productSales({ startDate: params.get("startDate"), endDate: params.get("endDate"), query: params.get("query"), status: params.get("status") }) }));
  } catch (error) {
    const appError = toAppError(error);
    return NextResponse.json(appError.toResponse(), { status: appError.status });
  }
}

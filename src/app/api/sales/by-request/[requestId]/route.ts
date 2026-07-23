import { NextResponse } from "next/server";

import { createGoogleSaleService } from "@/application/sales/service";
import { refreshAdminSessionCookie, requireAdminSession } from "@/application/admin/require-admin-session";
import { toAppError } from "@/lib/errors";

export async function GET(request: Request, context: { params: Promise<{ requestId: string }> }): Promise<Response> {
  try {
    if (!(await requireAdminSession(request))) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "認証が必要です" } }, { status: 401 });
    const { requestId } = await context.params;
    const sale = await createGoogleSaleService().findByRequestId(requestId);
    return refreshAdminSessionCookie(request, NextResponse.json({ data: sale ? { saleId: sale.saleId, requestId: sale.requestId, writeStatus: sale.writeStatus, experienceStatus: sale.experienceStatus, totalYen: sale.totalYen } : null }));
  } catch (error) {
    const appError = toAppError(error);
    return NextResponse.json(appError.toResponse(), { status: appError.status });
  }
}

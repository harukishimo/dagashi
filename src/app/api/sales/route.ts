import { NextResponse } from "next/server";

import { createGoogleSaleService } from "@/application/sales/service";
import type { CreateSaleInput } from "@/application/sales/service";
import { refreshAdminSessionCookie, requireAdminSession } from "@/application/admin/require-admin-session";
import { toAppError } from "@/lib/errors";

export async function POST(request: Request): Promise<Response> {
  try {
    if (!(await requireAdminSession(request, { requireOrigin: true }))) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "認証が必要です" } }, { status: 401 });
    const body: unknown = await request.json();
    const result = await createGoogleSaleService().create(body as CreateSaleInput);
    return refreshAdminSessionCookie(request, NextResponse.json({ data: { saleId: result.sale.saleId, requestId: result.sale.requestId, totalYen: result.sale.totalYen, writeStatus: result.sale.writeStatus, experienceStatus: result.sale.experienceStatus, idempotentReplay: result.idempotentReplay } }));
  } catch (error) {
    const appError = toAppError(error);
    return NextResponse.json(appError.toResponse(), { status: appError.status });
  }
}

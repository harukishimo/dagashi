import { NextResponse } from "next/server";

import { createGoogleSaleService } from "@/application/sales/service";
import { refreshAdminSessionCookie, requireAdminSession } from "@/application/admin/require-admin-session";
import { hasValidRequestOrigin } from "@/application/admin/require-admin-session";
import { toAppError } from "@/lib/errors";

export async function PATCH(request: Request, context: { params: Promise<{ saleId: string }> }): Promise<Response> {
  try {
    if (!hasValidRequestOrigin(request)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "この操作は許可されていません" } }, { status: 403 });
    const { saleId } = await context.params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(saleId)) return NextResponse.json({ error: { code: "NOT_FOUND", message: "対象のデータが見つかりません" } }, { status: 404 });
    const body: unknown = await request.json();
    const authorized = await requireAdminSession(request);
    const result = await createGoogleSaleService().challenge(saleId, body, authorized);
    const response = NextResponse.json({ data: result.result });
    return authorized ? refreshAdminSessionCookie(request, response) : response;
  } catch (error) {
    const appError = toAppError(error);
    return NextResponse.json(appError.toResponse(), { status: appError.status });
  }
}

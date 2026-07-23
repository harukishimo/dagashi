import { NextResponse } from "next/server";

import { createGoogleSaleService } from "@/application/sales/service";
import { hasValidRequestOrigin } from "@/application/admin/require-admin-session";
import { toAppError } from "@/lib/errors";

/** Explicit completion endpoint used when the browser leaves the challenge. */
export async function POST(request: Request, context: { params: Promise<{ saleId: string }> }): Promise<Response> {
  try {
    if (!hasValidRequestOrigin(request)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "この操作は許可されていません" } }, { status: 403 });
    const { saleId } = await context.params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(saleId)) return NextResponse.json({ error: { code: "NOT_FOUND", message: "対象のデータが見つかりません" } }, { status: 404 });
    const result = await createGoogleSaleService().challenge(saleId, { action: "interrupt" });
    return NextResponse.json({ data: result.result });
  } catch (error) {
    const appError = toAppError(error);
    return NextResponse.json(appError.toResponse(), { status: appError.status });
  }
}

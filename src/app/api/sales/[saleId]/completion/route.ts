import { NextResponse } from "next/server";

import { createGoogleSaleService } from "@/application/sales/service";
import { toAppError } from "@/lib/errors";

export async function GET(_request: Request, context: { params: Promise<{ saleId: string }> }): Promise<Response> {
  try {
    const { saleId } = await context.params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(saleId)) return NextResponse.json({ error: { code: "NOT_FOUND", message: "対象のデータが見つかりません" } }, { status: 404 });
    const result = await createGoogleSaleService().completion(saleId);
    return NextResponse.json({ data: result });
  } catch (error) {
    const appError = toAppError(error);
    return NextResponse.json(appError.toResponse(), { status: appError.status });
  }
}

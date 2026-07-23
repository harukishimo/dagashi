import { NextResponse } from "next/server";

import { refreshAdminSessionCookie, requireAdminSession } from "@/application/admin/require-admin-session";
import { createGoogleAdminService } from "@/application/admin/service";
import { AppError, toAppError } from "@/lib/errors";

export async function POST(request: Request): Promise<Response> {
  if (!(await requireAdminSession(request, { requireOrigin: true }))) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "認証が必要です" } }, { status: 401 });
  try {
    const body = (await request.json()) as { productId?: unknown; quantity?: unknown; cardConfirmed?: unknown };
    if (typeof body.productId !== "string" || body.cardConfirmed !== true) throw new AppError("VALIDATION_ERROR", { details: ["商品と紙カード15個の確認が必要です"] });
    const quantity = body.quantity === undefined ? 1 : body.quantity;
    if (typeof quantity !== "number") throw new AppError("VALIDATION_ERROR", { details: ["数量が不正です"] });
    return refreshAdminSessionCookie(request, NextResponse.json({ data: await createGoogleAdminService().redeemReward(body.productId, quantity) }, { status: 201 }));
  } catch (error) {
    const appError = toAppError(error);
    return NextResponse.json(appError.toResponse(), { status: appError.status });
  }
}

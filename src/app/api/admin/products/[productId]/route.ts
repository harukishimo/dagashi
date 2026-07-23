import { NextResponse } from "next/server";

import { refreshAdminSessionCookie, requireAdminSession } from "@/application/admin/require-admin-session";
import { createGoogleProductService } from "@/application/products/service";
import { toAppError } from "@/lib/errors";

interface RouteContext {
  params: Promise<{ productId: string }>;
}

function productResponse(product: Awaited<ReturnType<ReturnType<typeof createGoogleProductService>["get"]>>) {
  return {
    productId: product.productId,
    name: product.name,
    priceYen: product.priceYen,
    category: product.category,
    fallbackEmoji: product.fallbackEmoji,
    imageConfigured: Boolean(product.imageFileId),
    imageUpdatedAt: product.imageUpdatedAt,
    imageUrl: product.imageFileId ? `/api/product-images/${encodeURIComponent(product.productId)}?v=${encodeURIComponent(product.imageUpdatedAt ?? "")}` : null,
    displayOrder: product.displayOrder,
    status: product.status,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  if (!(await requireAdminSession(request))) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "認証が必要です" } }, { status: 401 });
  try {
    const { productId } = await context.params;
    const product = await createGoogleProductService().get(productId);
    return refreshAdminSessionCookie(request, NextResponse.json({ product: productResponse(product) }));
  } catch (error) {
    const appError = toAppError(error);
    return NextResponse.json(appError.toResponse(), { status: appError.status });
  }
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  if (!(await requireAdminSession(request, { requireOrigin: true }))) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "認証が必要です" } }, { status: 401 });
  try {
    const { productId } = await context.params;
    const input = (await request.json()) as Parameters<ReturnType<typeof createGoogleProductService>["update"]>[1];
    const result = await createGoogleProductService().update(productId, input);
    return refreshAdminSessionCookie(request, NextResponse.json({ product: productResponse(result.product), imageWarning: result.imageWarning ?? null }));
  } catch (error) {
    const appError = toAppError(error);
    return NextResponse.json(appError.toResponse(), { status: appError.status });
  }
}

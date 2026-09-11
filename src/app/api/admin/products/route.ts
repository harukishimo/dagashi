import { NextResponse } from "next/server";

import { refreshAdminSessionCookie, requireAdminSession } from "@/application/admin/require-admin-session";
import { createGoogleProductService } from "@/application/products/service";
import { toAppError } from "@/lib/errors";

function productResponse(product: Awaited<ReturnType<ReturnType<typeof createGoogleProductService>["get"]>>) {
  return {
    productId: product.productId,
    stockQuantity: product.stockQuantity ?? null,
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

export async function GET(request: Request): Promise<Response> {
  if (!(await requireAdminSession(request))) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "認証が必要です" } }, { status: 401 });
  try {
    const products = await createGoogleProductService().list();
    return refreshAdminSessionCookie(request, NextResponse.json({ products: products.map(productResponse) }));
  } catch (error) {
    const appError = toAppError(error);
    return NextResponse.json(appError.toResponse(), { status: appError.status });
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!(await requireAdminSession(request, { requireOrigin: true }))) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "認証が必要です" } }, { status: 401 });
  try {
    const input = (await request.json()) as Parameters<ReturnType<typeof createGoogleProductService>["create"]>[0];
    const result = await createGoogleProductService().create(input);
    return refreshAdminSessionCookie(request, NextResponse.json({ product: productResponse(result.product), imageWarning: result.imageWarning ?? null }, { status: 201 }));
  } catch (error) {
    const appError = toAppError(error);
    return NextResponse.json(appError.toResponse(), { status: appError.status });
  }
}

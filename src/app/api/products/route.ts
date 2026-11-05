import { NextResponse } from "next/server";

import { createGoogleProductService } from "@/application/products/service";
import { toAppError } from "@/lib/errors";
import { readOperationSettings } from "@/application/operation-settings";

export async function GET(): Promise<Response> {
  try {
    const [products, settings] = await Promise.all([createGoogleProductService().list({ activeOnly: true }), readOperationSettings()]);
    return NextResponse.json({
      shopDisplayMode: settings.shopDisplayMode,
      products: products.map((product) => ({
        productId: product.productId,
        status: product.status,
        stockQuantity: product.stockQuantity == null ? null : Math.max(0, product.stockQuantity),
        name: product.name,
        priceYen: product.priceYen,
        category: product.category,
        fallbackEmoji: product.fallbackEmoji,
        imageUrl: product.imageFileId ? `/api/product-images/${encodeURIComponent(product.productId)}?v=${encodeURIComponent(product.imageUpdatedAt ?? "")}` : null,
        imageUpdatedAt: product.imageUpdatedAt,
        displayOrder: product.displayOrder,
      })),
    });
  } catch (error) {
    const appError = toAppError(error);
    return NextResponse.json(appError.toResponse(), { status: appError.status, headers: {
      "cache-control": "no-store",
      ...(appError.status === 429 ? { "retry-after": "60" } : {}),
    } });
  }
}

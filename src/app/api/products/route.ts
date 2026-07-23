import { NextResponse } from "next/server";

import { createGoogleProductService } from "@/application/products/service";
import { toAppError } from "@/lib/errors";

export async function GET(): Promise<Response> {
  try {
    const products = await createGoogleProductService().list({ activeOnly: true });
    return NextResponse.json({
      products: products.map((product) => ({
        productId: product.productId,
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
    return NextResponse.json(appError.toResponse(), { status: appError.status });
  }
}

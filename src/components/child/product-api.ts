import type { ChildProduct, ProductsResponse } from "./types";

export async function fetchProducts(signal?: AbortSignal): Promise<ChildProduct[]> {
  return (await fetchProductCatalog(signal)).products;
}

export async function fetchProductCatalog(signal?: AbortSignal): Promise<{ products: ChildProduct[]; displayMode: "flat" | "price"; surveyEnabled: boolean }> {
  const response = await fetch("/api/products", { signal, cache: "no-store" });
  const body = (await response.json()) as ProductsResponse;
  if (!response.ok) throw new Error(body.error?.message ?? "商品を読み込めませんでした");
  const products = body.data?.products ?? body.products;
  if (!Array.isArray(products)) throw new Error("商品データの形式を確認してください");
  return { products: products.filter((product) => product && typeof product.productId === "string" && product.fallbackEmoji).sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0) || a.name.localeCompare(b.name, "ja")), displayMode: body.shopDisplayMode === "price" || body.shopDisplayMode === "category" ? "price" : "flat", surveyEnabled: body.customerSurveyEnabled === true };
}

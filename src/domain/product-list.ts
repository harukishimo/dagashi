import type { Product } from "./types";

export type ProductSort = "price_asc" | "price_desc" | "display_order" | "name" | "updated_desc";
type ListProduct = Pick<Product, "productId" | "name" | "priceYen" | "status" | "displayOrder" | "updatedAt">;
export function normalizeProductQuery(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("ja-JP").replace(/[\u30a1-\u30f6]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60)).replace(/\s+/g, "");
}
export function selectProducts<T extends ListProduct>(products: T[], options: { query: string; price: string; statuses: Product["status"][]; sort: ProductSort }): T[] {
  const query = normalizeProductQuery(options.query);
  return products.filter(product => (!query || normalizeProductQuery(product.name).includes(query)) && (options.price === "" || product.priceYen === Number(options.price)) && (!options.statuses.length || options.statuses.includes(product.status))).sort((a, b) => {
    const tie = a.displayOrder - b.displayOrder || a.name.localeCompare(b.name, "ja") || a.productId.localeCompare(b.productId);
    switch (options.sort) {
      case "price_asc": return a.priceYen - b.priceYen || tie;
      case "price_desc": return b.priceYen - a.priceYen || tie;
      case "display_order": return tie;
      case "name": return a.name.localeCompare(b.name, "ja") || tie;
      case "updated_desc": return b.updatedAt.localeCompare(a.updatedAt) || tie;
    }
  });
}

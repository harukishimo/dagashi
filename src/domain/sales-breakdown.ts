import { isCountedSale } from "./calculations";
import type { Sale, SaleItem } from "./types";

export type SaleWithItems = Sale & { items: SaleItem[] };

export function uniqueSaleItems(items: readonly SaleItem[]): SaleItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.saleItemId)) return false;
    seen.add(item.saleItemId);
    return true;
  });
}

/** Use sale-time snapshots; current catalog edits must not rewrite sales history. */
export function buildSalesBreakdown(sales: readonly SaleWithItems[]) {
  const products = new Map<string, { productId: string; names: string[]; quantity: number; amountYen: number }>();
  const seenSales = new Set<string>();
  const seenItems = new Set<string>();
  let saleCount = 0;
  for (const sale of sales) {
    if (!isCountedSale(sale) || seenSales.has(sale.saleId)) continue;
    seenSales.add(sale.saleId);
    saleCount++;
    for (const item of sale.items) {
      if (item.saleId !== sale.saleId || seenItems.has(item.saleItemId)) continue;
      seenItems.add(item.saleItemId);
      const product = products.get(item.productId) ?? { productId: item.productId, names: [], quantity: 0, amountYen: 0 };
      const name = item.productNameSnapshot || "商品名未記録";
      if (!product.names.includes(name)) product.names.push(name);
      product.quantity += item.quantity;
      product.amountYen += item.lineTotalYen;
      products.set(item.productId, product);
    }
  }
  const rows = [...products.values()];
  const totalYen = rows.reduce((sum, row) => sum + row.amountYen, 0);
  const totalQuantity = rows.reduce((sum, row) => sum + row.quantity, 0);
  return {
    saleCount, totalYen, totalQuantity,
    products: rows.sort((a, b) => b.amountYen - a.amountYen || b.quantity - a.quantity || a.productId.localeCompare(b.productId)).map((row) => ({
      ...row,
      amountRatio: totalYen > 0 ? row.amountYen / totalYen * 100 : 0,
      quantityRatio: totalQuantity > 0 ? row.quantity / totalQuantity * 100 : 0,
    })),
  };
}

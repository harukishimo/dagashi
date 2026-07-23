import type { Sale, SaleItem, RewardRedemption } from "./types";

export function calculateLineTotal(unitPriceYen: number, quantity: number): number {
  assertSafeNonNegativeInteger(unitPriceYen, "unitPriceYen");
  assertSafePositiveInteger(quantity, "quantity");
  const total = unitPriceYen * quantity;
  if (!Number.isSafeInteger(total)) throw new Error("line total exceeds safe integer range");
  return total;
}

export function calculateSaleTotal(items: ReadonlyArray<Pick<SaleItem, "unitPriceYen" | "quantity">>): number {
  const total = items.reduce((sum, item) => sum + calculateLineTotal(item.unitPriceYen, item.quantity), 0);
  if (!Number.isSafeInteger(total)) throw new Error("sale total exceeds safe integer range");
  return total;
}

export function isCountedSale(sale: Pick<Sale, "writeStatus" | "saleStatus">): boolean {
  return sale.writeStatus === "completed" && sale.saleStatus === "completed";
}

export function summarizeSales(
  sales: ReadonlyArray<Pick<Sale, "writeStatus" | "saleStatus" | "totalYen">>,
  itemsBySale: ReadonlyMap<string, ReadonlyArray<Pick<SaleItem, "quantity">>>,
  saleIds: ReadonlyArray<string>,
): { totalYen: number; saleCount: number; itemCount: number } {
  let totalYen = 0;
  let itemCount = 0;
  let saleCount = 0;
  sales.forEach((sale, index) => {
    if (!isCountedSale(sale)) return;
    totalYen += sale.totalYen;
    saleCount += 1;
    const saleId = saleIds[index];
    itemCount += (itemsBySale.get(saleId) ?? []).reduce((sum, item) => sum + item.quantity, 0);
  });
  return { totalYen, saleCount, itemCount };
}

export function countRewardRedemptions(
  redemptions: ReadonlyArray<Pick<RewardRedemption, "status" | "quantity">>,
): number {
  return redemptions
    .filter((redemption) => redemption.status === "completed")
    .reduce((sum, redemption) => sum + redemption.quantity, 0);
}

function assertSafeNonNegativeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${name} must be a non-negative safe integer`);
}

function assertSafePositiveInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${name} must be a positive safe integer`);
}

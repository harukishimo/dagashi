import type { Sale } from "./types";
import { isCountedSale } from "./calculations";

export const CUSTOMER_TYPES = ["family", "children", "adults", "unregistered"] as const;
export type CustomerType = typeof CUSTOMER_TYPES[number];
export const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = { family: "親子", children: "子どものみ", adults: "大人のみ", unregistered: "未登録" };

export function customerSurveySummary(sales: Sale[]) {
  const counted = [...new Map(sales.filter(isCountedSale).map(sale => [sale.saleId, sale])).values()];
  return CUSTOMER_TYPES.map(type => {
    const matches = counted.filter(sale => (sale.customerType ?? "unregistered") === type);
    return { type, count: matches.length, totalYen: matches.reduce((sum, sale) => sum + sale.totalYen, 0), ratio: counted.length ? matches.length / counted.length * 100 : 0 };
  });
}

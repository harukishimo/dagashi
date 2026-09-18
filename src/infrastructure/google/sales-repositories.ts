import { AppError } from "@/lib/errors";
import type { Sale, SaleItem } from "@/domain/types";

import { SHEET_HEADERS, type ProductRepository } from "./repositories";
import type { GoogleSheetsClient } from "./sheets-client";

export interface SaleRepository {
  findByRequestId(requestId: string): Promise<Sale | null>;
  findById(saleId: string): Promise<Sale | null>;
  appendPending(sale: Sale): Promise<void>;
  appendItems(items: SaleItem[]): Promise<void>;
  listItemsBySaleId(saleId: string): Promise<SaleItem[]>;
  update(sale: Sale): Promise<void>;
}

function text(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function nullableText(value: unknown): string | null {
  const result = text(value).trim();
  return result ? result : null;
}

function parseBoolean(value: unknown, rowNumber: number): boolean | null {
  const normalized = text(value).trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  throw new AppError("SHEETS_UNAVAILABLE", { details: [`sales row ${rowNumber} challenge_success is invalid`] });
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], label: string, rowNumber: number): T {
  const normalized = text(value).trim();
  if ((allowed as readonly string[]).includes(normalized)) return normalized as T;
  throw new AppError("SHEETS_UNAVAILABLE", { details: [`${label} row ${rowNumber} is invalid`] });
}

function uuidValue(value: unknown, label: string, rowNumber: number): string {
  const normalized = text(value).trim();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(normalized)) return normalized;
  throw new AppError("SHEETS_UNAVAILABLE", { details: [`${label} row ${rowNumber} is invalid`] });
}

function integerRange(value: unknown, min: number, max: number, label: string, rowNumber: number): number {
  const normalized = text(value).trim();
  if (!normalized) {
    throw new AppError("SHEETS_UNAVAILABLE", { details: [`${label} row ${rowNumber} is invalid`] });
  }
  const number = Number(normalized);
  if (!Number.isSafeInteger(number) || number < min || number > max) {
    throw new AppError("SHEETS_UNAVAILABLE", { details: [`${label} row ${rowNumber} is invalid`] });
  }
  return number;
}

export function toSale(row: unknown[], rowNumber: number): Sale {
  const expected = SHEET_HEADERS.sales;
  if (row.length < expected.length || row.length > expected.length + 2) throw new AppError("SHEETS_UNAVAILABLE", { details: [`sales row ${rowNumber} is invalid`] });
  if (Boolean(nullableText(row[15])) !== Boolean(nullableText(row[16]))) throw new AppError("SHEETS_UNAVAILABLE", { details: [`sales row ${rowNumber} event snapshot is incomplete`] });
  const elapsedText = nullableText(row[8]);
  const elapsedMs = elapsedText === null ? null : integerRange(elapsedText, 0, 60_000, "sales.elapsed_ms", rowNumber);
  const stampText = nullableText(row[10]);
  const stampCount = stampText === null ? null : integerRange(stampText, 1, 2, "sales.stamp_count", rowNumber) as 1 | 2;
  const sale: Sale = {
    saleId: uuidValue(row[0], "sales.sale_id", rowNumber), requestId: uuidValue(row[1], "sales.request_id", rowNumber), soldAt: text(row[2]),
    writeStatus: enumValue(row[3], ["pending", "completed", "error"], "sales.write_status", rowNumber),
    saleStatus: enumValue(row[4], ["completed", "voided"], "sales.sale_status", rowNumber),
    totalYen: integerRange(row[5], 0, 999_999_999, "sales.total_yen", rowNumber),
    paymentMethod: enumValue(row[6], ["cash", "other"], "sales.payment_method", rowNumber),
    experienceStatus: enumValue(row[7], ["challenge_pending", "challenge_started", "completed", "skipped", "interrupted"], "sales.experience_status", rowNumber), elapsedMs,
    challengeSuccess: parseBoolean(row[9], rowNumber), stampCount,
    voidedAt: nullableText(row[11]), voidReason: nullableText(row[12]), createdAt: text(row[13]), updatedAt: text(row[14]),
    eventId: nullableText(row[15]) ? uuidValue(row[15], "sales.event_id", rowNumber) : null,
    eventNameSnapshot: nullableText(row[16]),
  };
  return sale;
}

function toSaleItem(row: unknown[], rowNumber: number): SaleItem {
  const expected = SHEET_HEADERS.sale_items;
  if (row.length !== expected.length) throw new AppError("SHEETS_UNAVAILABLE", { details: [`sale_items row ${rowNumber} is invalid`] });
  const item: SaleItem = {
    saleItemId: uuidValue(row[0], "sale_items.sale_item_id", rowNumber), saleId: uuidValue(row[1], "sale_items.sale_id", rowNumber), productId: uuidValue(row[2], "sale_items.product_id", rowNumber), productNameSnapshot: text(row[3]),
    unitPriceYen: integerRange(row[4], 0, 999_999, "sale_items.unit_price_yen", rowNumber), quantity: integerRange(row[5], 1, 99, "sale_items.quantity", rowNumber), lineTotalYen: integerRange(row[6], 0, 99_999_999, "sale_items.line_total_yen", rowNumber), createdAt: text(row[7]),
  };
  if (!item.productNameSnapshot.trim() || item.lineTotalYen !== item.unitPriceYen * item.quantity) {
    throw new AppError("SHEETS_UNAVAILABLE", { details: [`sale_items row ${rowNumber} is invalid`] });
  }
  return item;
}

export function saleRow(sale: Sale): string[] {
  return [sale.saleId, sale.requestId, sale.soldAt, sale.writeStatus, sale.saleStatus, String(sale.totalYen), sale.paymentMethod, sale.experienceStatus, sale.elapsedMs === null ? "" : String(sale.elapsedMs), sale.challengeSuccess === null ? "" : String(sale.challengeSuccess).toUpperCase(), sale.stampCount === null ? "" : String(sale.stampCount), sale.voidedAt ?? "", sale.voidReason ?? "", sale.createdAt, sale.updatedAt, sale.eventId ?? "", sale.eventNameSnapshot ?? ""];
}

export function assertSalesHeader(row: unknown[], requireEvents = false): void {
  const headers = SHEET_HEADERS.sales;
  const baseValid = headers.every((header, index) => row[index] === header);
  const extended = row.length === 17 && row[15] === "event_id" && row[16] === "event_name_snapshot";
  if (!baseValid || (!extended && (requireEvents || row.length !== 15))) throw new AppError("SHEETS_UNAVAILABLE", { details: ["sales header mismatch: イベント列の移行を確認してください"] });
}

function itemRow(item: SaleItem): string[] {
  return [item.saleItemId, item.saleId, item.productId, item.productNameSnapshot, String(item.unitPriceYen), String(item.quantity), String(item.lineTotalYen), item.createdAt];
}

export class GoogleSheetsSaleRepository implements SaleRepository {
  constructor(private readonly client: GoogleSheetsClient) {}

  async findByRequestId(requestId: string): Promise<Sale | null> {
    return (await this.listSales()).find((sale) => sale.requestId === requestId) ?? null;
  }

  async findById(saleId: string): Promise<Sale | null> {
    return (await this.listSales()).find((sale) => sale.saleId === saleId) ?? null;
  }

  async appendPending(sale: Sale): Promise<void> {
    const response = await this.client.getValues("sales!A1:Q1");
    assertSalesHeader(response.values?.[0] ?? [], true);
    await this.client.appendValues("sales!A:Q", [saleRow(sale)], { uncertainWrite: true });
  }

  async appendItems(items: SaleItem[]): Promise<void> {
    if (items.length > 0) await this.client.appendValues("sale_items!A:H", items.map(itemRow), { uncertainWrite: true });
  }

  async listItemsBySaleId(saleId: string): Promise<SaleItem[]> {
    const response = await this.client.getValues("sale_items!A1:H10000");
    const rows = response.values ?? [];
    const headers = SHEET_HEADERS.sale_items;
    if (rows[0]?.length !== headers.length || headers.some((header, index) => text(rows[0]?.[index]) !== header)) throw new AppError("SHEETS_UNAVAILABLE", { details: ["sale_items header mismatch"] });
    return rows.slice(1).filter((row) => text(row[1]) === saleId).map((row, index) => toSaleItem(row, index + 2));
  }

  async update(sale: Sale): Promise<void> {
    const response = await this.client.getValues("sales!A1:Q10000");
    const rows = response.values ?? [];
    assertSalesHeader(rows[0] ?? []);
    const index = rows.findIndex((row, rowIndex) => rowIndex > 0 && text(row[0]) === sale.saleId);
    if (index < 1) throw new AppError("NOT_FOUND");
    const extended = rows[0].length === 17;
    await this.client.updateValues(`sales!A${index + 1}:${extended ? "Q" : "O"}${index + 1}`, [saleRow(sale).slice(0, extended ? 17 : 15)]);
  }

  private async listSales(): Promise<Sale[]> {
    const response = await this.client.getValues("sales!A1:Q10000");
    const rows = response.values ?? [];
    assertSalesHeader(rows[0] ?? []);
    return rows.slice(1).filter((row) => text(row[0]).trim() !== "").map((row, index) => toSale(row, index + 2));
  }
}

export interface SaleServiceRepositories {
  products: ProductRepository;
  sales: SaleRepository;
}

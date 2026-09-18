import { AppError } from "@/lib/errors";
import type { AuditLog, RewardRedemption, Sale, SaleItem, Setting } from "@/domain/types";
import {
  GoogleSheetsAuditLogRepository,
  GoogleSheetsSettingsRepository,
  SHEET_HEADERS,
  type AuditLogRepository,
} from "@/infrastructure/google/repositories";
import type { GoogleSheetsClient } from "@/infrastructure/google/sheets-client";
import { assertSalesHeader } from "@/infrastructure/google/sales-repositories";

export interface AdminDataRepository {
  listSales(): Promise<Sale[]>;
  listSaleItems(): Promise<SaleItem[]>;
  listRewards(): Promise<RewardRedemption[]>;
  listSettings(): Promise<Setting[]>;
  findSaleById(saleId: string): Promise<Sale | null>;
  updateSale(sale: Sale): Promise<void>;
  appendReward(reward: RewardRedemption): Promise<void>;
  appendAudit(log: AuditLog): Promise<void>;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : value === undefined || value === null ? "" : String(value);
}

function requiredText(value: unknown, label: string, rowNumber: number): string {
  const result = text(value).trim();
  if (!result) throw new AppError("SHEETS_UNAVAILABLE", { details: [`${label} row ${rowNumber} is invalid`] });
  return result;
}

function requiredUuid(value: unknown, label: string, rowNumber: number): string {
  const result = requiredText(value, label, rowNumber);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(result)) {
    throw new AppError("SHEETS_UNAVAILABLE", { details: [`${label} row ${rowNumber} is invalid`] });
  }
  return result;
}

function integer(value: unknown, label: string, rowNumber: number): number {
  const normalized = text(value).trim();
  if (!normalized) throw new AppError("SHEETS_UNAVAILABLE", { details: [`${label} row ${rowNumber} is invalid`] });
  const result = Number(normalized);
  if (!Number.isSafeInteger(result)) throw new AppError("SHEETS_UNAVAILABLE", { details: [`${label} row ${rowNumber} is invalid`] });
  return result;
}

function boundedInteger(value: unknown, min: number, max: number, label: string, rowNumber: number): number {
  const result = integer(value, label, rowNumber);
  if (result < min || result > max) throw new AppError("SHEETS_UNAVAILABLE", { details: [`${label} row ${rowNumber} is invalid`] });
  return result;
}

function enumText<T extends string>(value: unknown, allowed: readonly T[], label: string, rowNumber: number): T {
  const result = requiredText(value, label, rowNumber);
  if ((allowed as readonly string[]).includes(result)) return result as T;
  throw new AppError("SHEETS_UNAVAILABLE", { details: [`${label} row ${rowNumber} is invalid`] });
}

function nullableText(value: unknown): string | null {
  const result = text(value).trim();
  return result || null;
}

function booleanValue(value: unknown, label: string, rowNumber: number): boolean | null {
  const raw = text(value).trim().toLowerCase();
  if (!raw) return null;
  if (raw === "true") return true;
  if (raw === "false") return false;
  throw new AppError("SHEETS_UNAVAILABLE", { details: [`${label} row ${rowNumber} is invalid`] });
}

function assertHeader(sheet: keyof typeof SHEET_HEADERS, values: unknown[]): void {
  if (sheet === "sales") return assertSalesHeader(values);
  const expected = SHEET_HEADERS[sheet];
  if (values.length !== expected.length || expected.some((header, index) => text(values[index]) !== header)) {
    throw new AppError("SHEETS_UNAVAILABLE", { details: [`${sheet} header mismatch`] });
  }
}

function parseSale(row: unknown[], rowNumber: number): Sale {
  if (row.length < 15 || row.length > 17) throw new AppError("SHEETS_UNAVAILABLE", { details: [`sales row ${rowNumber} is invalid`] });
  if (Boolean(nullableText(row[15])) !== Boolean(nullableText(row[16]))) throw new AppError("SHEETS_UNAVAILABLE", { details: [`sales row ${rowNumber} event snapshot is incomplete`] });
  return {
    saleId: requiredUuid(row[0], "sales.sale_id", rowNumber),
    requestId: requiredUuid(row[1], "sales.request_id", rowNumber),
    soldAt: requiredText(row[2], "sales", rowNumber),
    writeStatus: enumText(row[3], ["pending", "completed", "error"], "sales.write_status", rowNumber),
    saleStatus: enumText(row[4], ["completed", "voided"], "sales.sale_status", rowNumber),
    totalYen: boundedInteger(row[5], 0, 999_999_999, "sales.total_yen", rowNumber),
    paymentMethod: enumText(row[6], ["cash", "other"], "sales.payment_method", rowNumber),
    experienceStatus: enumText(row[7], ["challenge_pending", "challenge_started", "completed", "skipped", "interrupted"], "sales.experience_status", rowNumber),
    elapsedMs: text(row[8]).trim() ? boundedInteger(row[8], 0, 60_000, "sales.elapsed_ms", rowNumber) : null,
    challengeSuccess: booleanValue(row[9], "sales", rowNumber),
    stampCount: text(row[10]).trim() ? boundedInteger(row[10], 1, 2, "sales.stamp_count", rowNumber) as Sale["stampCount"] : null,
    voidedAt: nullableText(row[11]),
    voidReason: nullableText(row[12]),
    createdAt: requiredText(row[13], "sales", rowNumber),
    updatedAt: requiredText(row[14], "sales", rowNumber),
    eventId: nullableText(row[15]) ? requiredUuid(row[15], "sales.event_id", rowNumber) : null,
    eventNameSnapshot: nullableText(row[16]),
  };
}

function saleRow(sale: Sale): string[] {
  return [
    sale.saleId,
    sale.requestId,
    sale.soldAt,
    sale.writeStatus,
    sale.saleStatus,
    String(sale.totalYen),
    sale.paymentMethod,
    sale.experienceStatus,
    sale.elapsedMs === null ? "" : String(sale.elapsedMs),
    sale.challengeSuccess === null ? "" : String(sale.challengeSuccess).toUpperCase(),
    sale.stampCount === null ? "" : String(sale.stampCount),
    sale.voidedAt ?? "",
    sale.voidReason ?? "",
    sale.createdAt,
    sale.updatedAt,
    sale.eventId ?? "",
    sale.eventNameSnapshot ?? "",
  ];
}

function parseSaleItem(row: unknown[], rowNumber: number): SaleItem {
  if (row.length !== SHEET_HEADERS.sale_items.length) throw new AppError("SHEETS_UNAVAILABLE", { details: [`sale_items row ${rowNumber} is invalid`] });
  const unitPriceYen = boundedInteger(row[4], 0, 999_999, "sale_items.unit_price_yen", rowNumber);
  const quantity = boundedInteger(row[5], 1, 99, "sale_items.quantity", rowNumber);
  const lineTotalYen = boundedInteger(row[6], 0, 99_999_999, "sale_items.line_total_yen", rowNumber);
  if (lineTotalYen !== unitPriceYen * quantity) throw new AppError("SHEETS_UNAVAILABLE", { details: [`sale_items row ${rowNumber} total mismatch`] });
  return {
    saleItemId: requiredUuid(row[0], "sale_items.sale_item_id", rowNumber),
    saleId: requiredUuid(row[1], "sale_items.sale_id", rowNumber),
    productId: requiredUuid(row[2], "sale_items.product_id", rowNumber),
    productNameSnapshot: requiredText(row[3], "sale_items", rowNumber),
    unitPriceYen,
    quantity,
    lineTotalYen,
    createdAt: requiredText(row[7], "sale_items", rowNumber),
  };
}

function parseReward(row: unknown[], rowNumber: number): RewardRedemption {
  if (row.length !== SHEET_HEADERS.reward_redemptions.length) throw new AppError("SHEETS_UNAVAILABLE", { details: [`reward_redemptions row ${rowNumber} is invalid`] });
  const amountYen = boundedInteger(row[5], 0, 0, "reward_redemptions.amount_yen", rowNumber);
  if (amountYen !== 0) throw new AppError("SHEETS_UNAVAILABLE", { details: [`reward_redemptions row ${rowNumber} amount must be 0`] });
  return {
    redemptionId: requiredUuid(row[0], "reward_redemptions.redemption_id", rowNumber),
    redeemedAt: requiredText(row[1], "reward_redemptions", rowNumber),
    productId: requiredUuid(row[2], "reward_redemptions.product_id", rowNumber),
    productNameSnapshot: requiredText(row[3], "reward_redemptions", rowNumber),
    quantity: boundedInteger(row[4], 1, 1, "reward_redemptions.quantity", rowNumber),
    amountYen: 0,
    status: enumText(row[6], ["completed", "voided"], "reward_redemptions.status", rowNumber),
    voidedAt: nullableText(row[7]),
    voidReason: nullableText(row[8]),
    createdAt: requiredText(row[9], "reward_redemptions", rowNumber),
    updatedAt: requiredText(row[10], "reward_redemptions", rowNumber),
  };
}

export class GoogleAdminDataRepository implements AdminDataRepository {
  private readonly audit: AuditLogRepository;

  constructor(private readonly client: GoogleSheetsClient) {
    this.audit = new GoogleSheetsAuditLogRepository(client);
  }

  async listSales(): Promise<Sale[]> {
    const rows = await this.read("sales", "A1:Q10000");
    return rows.slice(1).filter((row) => row.some((value) => text(value).trim() !== "")).map((row, index) => parseSale(row, index + 2));
  }

  async listSaleItems(): Promise<SaleItem[]> {
    const rows = await this.read("sale_items", "A1:H10000");
    return rows.slice(1).filter((row) => row.some((value) => text(value).trim() !== "")).map((row, index) => parseSaleItem(row, index + 2));
  }

  async listRewards(): Promise<RewardRedemption[]> {
    const rows = await this.read("reward_redemptions", "A1:K10000");
    return rows.slice(1).filter((row) => row.some((value) => text(value).trim() !== "")).map((row, index) => parseReward(row, index + 2));
  }

  async listSettings(): Promise<Setting[]> {
    return new GoogleSheetsSettingsRepository(this.client).list();
  }

  async findSaleById(saleId: string): Promise<Sale | null> {
    return (await this.listSales()).find((sale) => sale.saleId === saleId) ?? null;
  }

  async updateSale(sale: Sale): Promise<void> {
    const rows = await this.read("sales", "A1:Q10000");
    const index = rows.findIndex((row, rowIndex) => rowIndex > 0 && text(row[0]) === sale.saleId);
    if (index < 1) throw new AppError("NOT_FOUND");
    const extended = rows[0].length === 17;
    await this.client.updateValues(`sales!A${index + 1}:${extended ? "Q" : "O"}${index + 1}`, [saleRow(sale).slice(0, extended ? 17 : 15)]);
  }

  async appendReward(reward: RewardRedemption): Promise<void> {
    await this.client.appendValues("reward_redemptions!A:K", [[
      reward.redemptionId,
      reward.redeemedAt,
      reward.productId,
      reward.productNameSnapshot,
      String(reward.quantity),
      "0",
      reward.status,
      reward.voidedAt ?? "",
      reward.voidReason ?? "",
      reward.createdAt,
      reward.updatedAt,
    ]]);
  }

  appendAudit(log: AuditLog): Promise<void> {
    return this.audit.append(log);
  }

  private async read(sheet: keyof typeof SHEET_HEADERS, range: string): Promise<string[][]> {
    const response = await this.client.getValues(`${sheet}!${range}`);
    const values = response.values ?? [];
    assertHeader(sheet, values[0] ?? []);
    return values;
  }
}

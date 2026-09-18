import { AppError } from "@/lib/errors";
import { productRowSchema, validateProduct } from "@/domain/validation";
import type { AuditLog, Product, Setting } from "@/domain/types";

import type { GoogleSheetsClient } from "./sheets-client";
import { GoogleAdminDataRepository } from "@/application/admin/data";

/** Count each ledger entry once. Pending sales reserve their written items. */
export async function inventoryConsumption(client: GoogleSheetsClient): Promise<Map<string, number>> {
  const data = new GoogleAdminDataRepository(client);
  const [sales, items, rewards] = await Promise.all([data.listSales(), data.listSaleItems(), data.listRewards()]);
  const liveSales = new Set(sales.filter((sale) => sale.saleStatus !== "voided").map((sale) => sale.saleId));
  const consumed = new Map<string, number>();
  const seen = new Set<string>();
  for (const item of items) {
    if (!liveSales.has(item.saleId) || seen.has(item.saleItemId)) continue;
    seen.add(item.saleItemId);
    consumed.set(item.productId, (consumed.get(item.productId) ?? 0) + item.quantity);
  }
  for (const reward of rewards) {
    if (reward.status !== "completed" || seen.has(reward.redemptionId)) continue;
    seen.add(reward.redemptionId);
    consumed.set(reward.productId, (consumed.get(reward.productId) ?? 0) + reward.quantity);
  }
  return consumed;
}

export interface ProductImageRepository {
  inspect(fileId: string): Promise<{
    id: string;
    name: string;
    mimeType: "image/webp" | "image/png" | "image/jpeg";
    size: number;
    modifiedTime: string;
    parents: string[];
    trashed: boolean;
  }>;
  download(fileId: string): Promise<{ body: ArrayBuffer; contentType: "image/webp" | "image/png" | "image/jpeg"; etag?: string }>;
  normalizeFileId(source: string): string;
}

export interface ProductRepository {
  listAll(): Promise<Product[]>;
  findById(productId: string): Promise<Product | null>;
  create(product: Product): Promise<Product>;
  update(product: Product): Promise<Product>;
}

export interface SettingsRepository {
  list(): Promise<Setting[]>;
  find(key: string): Promise<Setting | null>;
}

export interface AuditLogRepository {
  append(log: AuditLog): Promise<void>;
}

export const SHEET_HEADERS = {
  products: ["product_id", "name", "price_yen", "category", "fallback_emoji", "image_file_id", "image_updated_at", "display_order", "status", "created_at", "updated_at"],
  sales: ["sale_id", "request_id", "sold_at", "write_status", "sale_status", "total_yen", "payment_method", "experience_status", "elapsed_ms", "challenge_success", "stamp_count", "voided_at", "void_reason", "created_at", "updated_at"],
  sale_items: ["sale_item_id", "sale_id", "product_id", "product_name_snapshot", "unit_price_yen", "quantity", "line_total_yen", "created_at"],
  reward_redemptions: ["redemption_id", "redeemed_at", "product_id", "product_name_snapshot", "quantity", "amount_yen", "status", "voided_at", "void_reason", "created_at", "updated_at"],
  settings: ["key", "value", "updated_at"],
  audit_logs: ["log_id", "occurred_at", "action", "target_type", "target_id", "summary"],
} as const;

export type SheetName = keyof typeof SHEET_HEADERS;

function text(value: unknown): string {
  return typeof value === "string" ? value : value === undefined || value === null ? "" : String(value);
}

function nullableText(value: unknown): string | null {
  const result = text(value).trim();
  return result ? result : null;
}

function rowToProduct(raw: unknown[], rowNumber: number): Product {
  if (raw.length !== SHEET_HEADERS.products.length) {
    throw new AppError("SHEETS_UNAVAILABLE", { details: [`products row ${rowNumber} is invalid`] });
  }
  const row = Object.fromEntries(SHEET_HEADERS.products.map((header, index) => [header, text(raw[index])]));
  const parsed = productRowSchema.safeParse(row);
  if (!parsed.success) {
    throw new AppError("SHEETS_UNAVAILABLE", { details: [`products row ${rowNumber} is invalid`] });
  }
  const product: Product = {
    productId: parsed.data.product_id,
    name: parsed.data.name,
    priceYen: Number(parsed.data.price_yen),
    category: parsed.data.category,
    fallbackEmoji: parsed.data.fallback_emoji.trim(),
    imageFileId: nullableText(parsed.data.image_file_id),
    imageUpdatedAt: nullableText(parsed.data.image_updated_at),
    displayOrder: Number(parsed.data.display_order),
    status: parsed.data.status,
    createdAt: parsed.data.created_at,
    updatedAt: parsed.data.updated_at,
  };
  try {
    return validateProduct(product);
  } catch {
    throw new AppError("SHEETS_UNAVAILABLE", { details: [`products row ${rowNumber} violates domain constraints`] });
  }
}

function productToRow(product: Product): string[] {
  return [
    product.productId,
    product.name,
    String(product.priceYen),
    product.category,
    product.fallbackEmoji,
    product.imageFileId ?? "",
    product.imageUpdatedAt ?? "",
    String(product.displayOrder),
    product.status,
    product.createdAt,
    product.updatedAt,
  ];
}

function assertHeader(sheet: SheetName, values: unknown[]): void {
  const expected = SHEET_HEADERS[sheet];
  if (values.length !== expected.length || expected.some((header, index) => text(values[index]) !== header)) {
    throw new AppError("SHEETS_UNAVAILABLE", { details: [`${sheet} header mismatch`] });
  }
}

export class GoogleSheetsProductRepository implements ProductRepository {
  constructor(private readonly client: GoogleSheetsClient) {}

  /** Image lookup must not read stock totals or any sales ledger. */
  async findImageProductById(productId: string): Promise<Product | null> {
    const rows = (await this.client.getImageCatalog()).values ?? [];
    assertHeader("products", rows[0] ?? []);
    const index = rows.findIndex((row, i) => i > 0 && text(row[0]) === productId);
    return index < 1 ? null : rowToProduct(rows[index], index + 1);
  }

  async listAll(): Promise<Product[]> {
    const response = await this.client.getValues("products!A1:K1000");
    const rows = response.values ?? [];
    assertHeader("products", rows[0] ?? []);
    const products = rows.slice(1).filter((row) => row.some((value) => text(value).trim() !== "")).map((row, index) => rowToProduct(row, index + 2));
    const stockRows = (await this.client.getValues("products!L1:L1000")).values ?? [];
    if (!stockRows[0]?.[0]) return products;
    if (text(stockRows[0][0]) !== "stock_total") throw new AppError("SHEETS_UNAVAILABLE");
    const consumption = await inventoryConsumption(this.client);
    return products.map((product) => {
      const rowIndex = rows.findIndex((row) => text(row[0]) === product.productId);
      const raw = text(stockRows[rowIndex]?.[0]).trim();
      if (!raw) return { ...product, stockQuantity: null };
      const total = Number(raw);
      if (!Number.isSafeInteger(total) || total < 0) throw new AppError("SHEETS_UNAVAILABLE");
      return { ...product, stockQuantity: total - (consumption.get(product.productId) ?? 0) };
    });
  }

  async findById(productId: string): Promise<Product | null> {
    const products = await this.listAll();
    return products.find((product) => product.productId === productId) ?? null;
  }

  async create(product: Product): Promise<Product> {
    validateProduct(product);
    if (product.stockQuantity != null) {
      const header = (await this.client.getValues("products!L1")).values?.[0]?.[0];
      if (header && text(header) !== "stock_total") throw new AppError("SHEETS_UNAVAILABLE");
      await this.client.updateValues("products!L1", [["stock_total"]]);
      await this.client.appendValues("products!A:L", [[...productToRow(product), String(product.stockQuantity)]]);
    } else {
      await this.client.appendValues("products!A:K", [productToRow(product)]);
    }
    return product;
  }

  async update(product: Product): Promise<Product> {
    validateProduct(product);
    const response = await this.client.getValues("products!A1:K1000");
    const rows = response.values ?? [];
    assertHeader("products", rows[0] ?? []);
    const rowIndex = rows.findIndex((row, index) => index > 0 && text(row[0]) === product.productId);
    if (rowIndex < 1) throw new AppError("NOT_FOUND");
    await this.client.updateValues(`products!A${rowIndex + 1}:K${rowIndex + 1}`, [productToRow(product)]);
    if (product.stockQuantity !== undefined) await this.saveStock(product);
    return product;
  }

  private async saveStock(product: Product): Promise<void> {
    const header = (await this.client.getValues("products!L1")).values?.[0]?.[0];
    if (header && text(header) !== "stock_total") throw new AppError("SHEETS_UNAVAILABLE");
    const rows = (await this.client.getValues("products!A1:A1000")).values ?? [];
    const index = rows.findIndex((row) => text(row[0]) === product.productId);
    if (index < 1) throw new AppError("NOT_FOUND");
    const consumed = product.stockQuantity == null ? 0 : (await inventoryConsumption(this.client)).get(product.productId) ?? 0;
    await this.client.updateValues("products!L1", [["stock_total"]]);
    await this.client.updateValues(`products!L${index + 1}`, [[product.stockQuantity == null ? "" : String(product.stockQuantity + consumed)]]);
  }
}

export class GoogleSheetsSettingsRepository implements SettingsRepository {
  constructor(private readonly client: GoogleSheetsClient) {}

  async list(): Promise<Setting[]> {
    const response = await this.client.getValues("settings!A1:C100");
    const rows = response.values ?? [];
    assertHeader("settings", rows[0] ?? []);
    return rows.slice(1).filter((row) => text(row[0]).trim() !== "").map((row, index) => {
      if (row.length !== SHEET_HEADERS.settings.length) {
        throw new AppError("SHEETS_UNAVAILABLE", { details: [`settings row ${index + 2} is invalid`] });
      }
      return { key: text(row[0]), value: text(row[1]), updatedAt: text(row[2]) };
    });
  }

  async find(key: string): Promise<Setting | null> {
    const settings = await this.list();
    return settings.find((setting) => setting.key === key) ?? null;
  }
}

export class GoogleSheetsAuditLogRepository implements AuditLogRepository {
  constructor(private readonly client: GoogleSheetsClient) {}

  async append(log: AuditLog): Promise<void> {
    await this.client.appendValues("audit_logs!A:F", [[log.logId, log.occurredAt, log.action, log.targetType, log.targetId, log.summary]]);
  }
}

export class GoogleSheetsSchemaRepository {
  constructor(private readonly client: GoogleSheetsClient) {}

  async validateSchema(): Promise<void> {
    for (const [sheet, headers] of Object.entries(SHEET_HEADERS) as [SheetName, readonly string[]][]) {
      const lastColumn = String.fromCharCode(64 + headers.length);
      const response = await this.client.getValues(`${sheet}!A1:${lastColumn}1`);
      assertHeader(sheet, response.values?.[0] ?? []);
    }
    const settings = new GoogleSheetsSettingsRepository(this.client);
    const entries = await settings.list();
    const version = entries.find((entry) => entry.key === "schema_version");
    if (!version || version.value !== "2") throw new AppError("SHEETS_UNAVAILABLE", { details: ["settings.schema_version must be 2"] });
    const toggles = entries.filter((entry) => entry.key === "challenge_enabled");
    if (toggles.length !== 1 || !["true", "false"].includes(toggles[0].value)) {
      throw new AppError("SHEETS_UNAVAILABLE", { details: ["settings.challenge_enabled migration required"] });
    }
    const extensions = [
      ["sales!P1:Q1", ["event_id", "event_name_snapshot"]],
      ["events!A1:F1", ["event_id", "name", "start_date", "end_date", "created_at", "status"]],
    ] as const;
    for (const [range, headers] of extensions) {
      const response = await this.client.getValues(range);
      const row = response.values?.[0] ?? [];
      if (row.length !== headers.length || headers.some((header, index) => row[index] !== header)) {
        throw new AppError("SHEETS_UNAVAILABLE", { details: ["event schema migration required"] });
      }
    }
  }
}

import { randomUUID } from "node:crypto";

import { getServerEnv } from "@/config/env";
import type { Product, RewardRedemption, Sale, SaleItem } from "@/domain/types";
import { isCountedSale } from "@/domain/calculations";
import { AppError } from "@/lib/errors";
import { GoogleAccessTokenProvider } from "@/infrastructure/google/auth";
import { GoogleSheetsClient } from "@/infrastructure/google/sheets-client";
import { GoogleSheetsProductRepository } from "@/infrastructure/google/repositories";
import { GoogleAdminDataRepository, type AdminDataRepository } from "./data";

export interface DashboardResult {
  date: string;
  totalYen: number;
  saleCount: number;
  itemCount: number;
  rewardCount: number;
  voidCount: number;
  incompleteCount: number;
  recentSales: Sale[];
}

export interface ProductSalesRow {
  productId: string;
  name: string;
  category: string;
  status: Product["status"];
  quantity: number;
  totalYen: number;
  rewardQuantity: number;
}

export interface AdminServiceDependencies {
  data: AdminDataRepository;
  products: { list(): Promise<Product[]>; get(productId: string): Promise<Product> };
  now?: () => Date;
  timeZone?: string;
}

function dateKey(value: string | Date, timeZone: string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function inRange(value: string, start: string, end: string, timeZone: string): boolean {
  const key = dateKey(value, timeZone);
  return Boolean(key) && key >= start && key <= end;
}

function validateDate(value: string | null, fallback: string): string {
  const result = value?.trim() || fallback;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) throw new AppError("VALIDATION_ERROR", { details: ["日付はYYYY-MM-DD形式で指定してください"] });
  return result;
}

function sumItems(items: SaleItem[], saleIds: ReadonlySet<string>): number {
  return items.filter((item) => saleIds.has(item.saleId)).reduce((sum, item) => sum + item.quantity, 0);
}

export class AdminService {
  private readonly now: () => Date;
  private readonly timeZone: string;

  constructor(private readonly deps: AdminServiceDependencies) {
    this.now = deps.now ?? (() => new Date());
    this.timeZone = deps.timeZone ?? "Asia/Tokyo";
  }

  async dashboard(date?: string): Promise<DashboardResult> {
    const targetDate = validateDate(date ?? null, dateKey(this.now(), this.timeZone));
    const [sales, items, rewards] = await Promise.all([this.deps.data.listSales(), this.deps.data.listSaleItems(), this.deps.data.listRewards()]);
    const daySales = sales.filter((sale) => dateKey(sale.soldAt, this.timeZone) === targetDate);
    const counted = daySales.filter((sale) => isCountedSale(sale));
    const countedIds = new Set(counted.map((sale) => sale.saleId));
    return {
      date: targetDate,
      totalYen: counted.reduce((sum, sale) => sum + sale.totalYen, 0),
      saleCount: counted.length,
      itemCount: sumItems(items, countedIds),
      rewardCount: rewards.filter((reward) => reward.status === "completed" && dateKey(reward.redeemedAt, this.timeZone) === targetDate).reduce((sum, reward) => sum + reward.quantity, 0),
      voidCount: daySales.filter((sale) => sale.saleStatus === "voided").length,
      incompleteCount: daySales.filter((sale) => sale.writeStatus !== "completed").length,
      recentSales: [...daySales].sort((a, b) => b.soldAt.localeCompare(a.soldAt)).slice(0, 10),
    };
  }

  async productSales(options: { startDate?: string | null; endDate?: string | null; query?: string | null; status?: string | null } = {}): Promise<{ startDate: string; endDate: string; rows: ProductSalesRow[] }> {
    const defaultDate = dateKey(this.now(), this.timeZone);
    const startDate = validateDate(options.startDate ?? null, defaultDate);
    const endDate = validateDate(options.endDate ?? null, startDate);
    if (startDate > endDate) throw new AppError("VALIDATION_ERROR", { details: ["開始日は終了日以前にしてください"] });
    const [products, sales, items, rewards] = await Promise.all([this.deps.products.list(), this.deps.data.listSales(), this.deps.data.listSaleItems(), this.deps.data.listRewards()]);
    const counted = sales.filter((sale) => isCountedSale(sale) && inRange(sale.soldAt, startDate, endDate, this.timeZone));
    const countedIds = new Set(counted.map((sale) => sale.saleId));
    const itemByProduct = new Map<string, { quantity: number; totalYen: number }>();
    items.filter((item) => countedIds.has(item.saleId)).forEach((item) => {
      const current = itemByProduct.get(item.productId) ?? { quantity: 0, totalYen: 0 };
      itemByProduct.set(item.productId, { quantity: current.quantity + item.quantity, totalYen: current.totalYen + item.lineTotalYen });
    });
    const rewardByProduct = new Map<string, number>();
    rewards.filter((reward) => reward.status === "completed" && inRange(reward.redeemedAt, startDate, endDate, this.timeZone)).forEach((reward) => rewardByProduct.set(reward.productId, (rewardByProduct.get(reward.productId) ?? 0) + reward.quantity));
    const query = options.query?.trim().toLowerCase() ?? "";
    const requestedStatus = options.status?.trim();
    const rows = products.filter((product) => (!requestedStatus || requestedStatus === "all" || product.status === requestedStatus) && (!query || product.name.toLowerCase().includes(query) || product.category.toLowerCase().includes(query))).map((product) => ({
      productId: product.productId,
      name: product.name,
      category: product.category,
      status: product.status,
      quantity: itemByProduct.get(product.productId)?.quantity ?? 0,
      totalYen: itemByProduct.get(product.productId)?.totalYen ?? 0,
      rewardQuantity: rewardByProduct.get(product.productId) ?? 0,
    }));
    return { startDate, endDate, rows };
  }

  async sales(options: { saleId?: string | null; startDate?: string | null; endDate?: string | null; eventId?: string | null } = {}): Promise<{ sales: Array<Sale & { items: SaleItem[] }> }> {
    const [sales, items] = await Promise.all([this.deps.data.listSales(), this.deps.data.listSaleItems()]);
    const startDate = options.startDate ? validateDate(options.startDate, options.startDate) : null;
    const endDate = options.endDate ? validateDate(options.endDate, options.endDate) : null;
    const result = sales.filter((sale) => (!options.saleId || sale.saleId === options.saleId) && (!startDate || dateKey(sale.soldAt, this.timeZone) >= startDate) && (!endDate || dateKey(sale.soldAt, this.timeZone) <= endDate)).sort((a, b) => b.soldAt.localeCompare(a.soldAt)).map((sale) => ({ ...sale, items: items.filter((item) => item.saleId === sale.saleId) }));
    return { sales: result.filter((sale) => !options.eventId || (options.eventId === "none" ? !sale.eventId : sale.eventId === options.eventId)) };
  }

  async voidSale(saleId: string, reason: string): Promise<Sale> {
    const normalizedReason = reason.trim();
    if (!normalizedReason || normalizedReason.length > 200) throw new AppError("VALIDATION_ERROR", { details: ["取消理由は1〜200文字で入力してください"] });
    const sale = await this.deps.data.findSaleById(saleId);
    if (!sale) throw new AppError("NOT_FOUND");
    if (sale.writeStatus !== "completed" || sale.saleStatus !== "completed") throw new AppError("CONFLICT", { details: ["未完了または取消済みの売上は取消できません"] });
    const now = this.now().toISOString();
    const updated: Sale = { ...sale, saleStatus: "voided", voidedAt: now, voidReason: normalizedReason, updatedAt: now };
    await this.deps.data.updateSale(updated);
    await this.deps.data.appendAudit({ logId: randomUUID(), occurredAt: now, action: "sale.void", targetType: "sale", targetId: sale.saleId, summary: "売上を理由付きで取消" });
    return updated;
  }

  async redeemReward(productId: string, quantity = 1): Promise<RewardRedemption> {
    if (!Number.isInteger(quantity) || quantity !== 1) throw new AppError("VALIDATION_ERROR", { details: ["特典交換数量は1個にしてください"] });
    const product = await this.deps.products.get(productId);
    if (product.status !== "active" || (product.stockQuantity != null && product.stockQuantity < quantity)) {
      throw new AppError("CONFLICT", { details: ["この商品は売り切れ、または在庫不足です"] });
    }
    const now = this.now().toISOString();
    const reward: RewardRedemption = { redemptionId: randomUUID(), redeemedAt: now, productId: product.productId, productNameSnapshot: product.name, quantity, amountYen: 0, status: "completed", voidedAt: null, voidReason: null, createdAt: now, updatedAt: now };
    await this.deps.data.appendReward(reward);
    await this.deps.data.appendAudit({ logId: randomUUID(), occurredAt: now, action: "reward.redeem", targetType: "reward_redemption", targetId: reward.redemptionId, summary: "特典交換を記録" });
    return reward;
  }

  async settings(): Promise<SettingMap> {
    const settings = await this.deps.data.listSettings();
    return Object.fromEntries(settings.map((setting) => [setting.key, setting.value]));
  }
}

export type SettingMap = Record<string, string>;

export function createGoogleAdminService(): AdminService {
  const env = getServerEnv();
  const credentials = env.GOOGLE_CLIENT_EMAIL && env.GOOGLE_PRIVATE_KEY ? { clientEmail: env.GOOGLE_CLIENT_EMAIL, privateKey: env.GOOGLE_PRIVATE_KEY } : undefined;
  const tokenProvider = credentials ? new GoogleAccessTokenProvider(credentials) : undefined;
  const client = new GoogleSheetsClient({ spreadsheetId: env.GOOGLE_SPREADSHEET_ID, tokenProvider });
  const data = new GoogleAdminDataRepository(client);
  const productsRepository = new GoogleSheetsProductRepository(client);
  return new AdminService({ data, products: { list: () => productsRepository.listAll(), get: async (id) => (await productsRepository.findById(id)) ?? (() => { throw new AppError("NOT_FOUND"); })() }, timeZone: env.APP_TIMEZONE });
}

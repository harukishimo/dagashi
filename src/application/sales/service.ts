import { randomUUID } from "node:crypto";

import { calculateLineTotal, calculateSaleTotal, resultForElapsed, resultForInterrupt, resultForSkip, transitionChallenge } from "@/domain";
import { saleInputSchema, challengeInputSchema } from "@/domain/validation";
import type { ChallengeResult, Product, Sale, SaleItem, SaleItemInput } from "@/domain/types";
import { AppError } from "@/lib/errors";
import type { ProductRepository, SettingsRepository } from "@/infrastructure/google/repositories";
import type { SaleRepository } from "@/infrastructure/google/sales-repositories";
import { GoogleSheetsProductRepository, GoogleSheetsSettingsRepository } from "@/infrastructure/google/repositories";
import { GoogleSheetsClient } from "@/infrastructure/google/sheets-client";
import { GoogleAccessTokenProvider } from "@/infrastructure/google/auth";
import { GoogleSheetsSaleRepository } from "@/infrastructure/google/sales-repositories";
import { getServerEnv } from "@/config/env";
import { eventForSale } from "@/domain/events";
import { GoogleEventRepository, type EventRepository } from "@/infrastructure/google/event-repository";

export interface CreateSaleInput {
  requestId: string;
  paymentMethod: "cash" | "other";
  items: SaleItemInput[];
}

export interface CreateSaleResult {
  sale: Sale;
  items: SaleItem[];
  idempotentReplay: boolean;
}

export interface SaleServiceDependencies {
  products: ProductRepository;
  sales: SaleRepository;
  settings?: SettingsRepository;
  events?: EventRepository;
  now?: () => Date;
}

// API route handlers create a SaleService per request. Keep the process-local
// mutex outside the instance so those handlers still serialize the same
// requestId/saleId while they share a Sheets repository backend.
const sharedSaleLocks = new Map<string, Promise<void>>();

export class SaleService {
  private readonly now: () => Date;

  constructor(private readonly deps: SaleServiceDependencies) {
    this.now = deps.now ?? (() => new Date());
  }

  async create(input: CreateSaleInput): Promise<CreateSaleResult> {
    const parsed = saleInputSchema.parse(input);
    return this.withKeyLock("inventory", () => this.createLocked(parsed));
  }

  /**
   * Google Sheets has no unique constraint. This process-local mutex closes
   * the same-request race for a single Next.js instance; callers still
   * re-read by requestId after retries, and multi-instance deployment needs a
   * datastore with a real unique constraint.
   */
  private async createLocked(parsed: CreateSaleInput): Promise<CreateSaleResult> {
    const existing = await this.deps.sales.findByRequestId(parsed.requestId);
    if (existing?.writeStatus === "completed") {
      const items = await this.deps.sales.listItemsBySaleId(existing.saleId);
      return { sale: existing, items, idempotentReplay: true };
    }
    const shopEnabled = await this.deps.settings?.find("shop_enabled");
    if (shopEnabled?.value.trim().toLowerCase() === "false") {
      throw new AppError("CONFLICT", { details: ["現在はお店が受付停止中です"] });
    }
    if (existing) throw new AppError("SALE_STATUS_UNKNOWN", { retryable: true });

    const products = await this.deps.products.listAll();
    const productMap = new Map(products.map((product) => [product.productId, product]));
    const quantities = new Map<string, number>();
    for (const item of parsed.items) quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
    for (const [id, quantity] of quantities) {
      const product = productMap.get(id);
      if (product?.stockQuantity != null && quantity > product.stockQuantity) {
        throw new AppError("CONFLICT", { details: ["在庫が不足しています。商品を選び直してください"] });
      }
    }
    const saleId = randomUUID();
    const items = parsed.items.map((input) => this.buildItem(saleId, input, productMap));
    const now = this.now().toISOString();
    const [events, challengeSetting] = await Promise.all([this.deps.events?.list() ?? [], this.deps.settings?.find("challenge_enabled")]);
    const event = eventForSale(events, now);
    const challengeEnabled = challengeSetting?.value.trim().toLowerCase() !== "false";
    const sale: Sale = {
      saleId, requestId: parsed.requestId, soldAt: now,
      writeStatus: "pending", saleStatus: "completed", totalYen: calculateSaleTotal(items), paymentMethod: parsed.paymentMethod,
      experienceStatus: challengeEnabled ? "challenge_pending" : "skipped", elapsedMs: null, challengeSuccess: challengeEnabled ? null : false, stampCount: challengeEnabled ? null : 1,
      eventId: event?.eventId ?? null, eventNameSnapshot: event?.name ?? null,
      voidedAt: null, voidReason: null, createdAt: now, updatedAt: now,
    };
    await this.deps.sales.appendPending(sale);
    await this.deps.sales.appendItems(items);
    const savedItems = await this.deps.sales.listItemsBySaleId(sale.saleId);
    if (savedItems.length !== items.length || calculateSaleTotal(savedItems) !== sale.totalYen) {
      const failed: Sale = { ...sale, writeStatus: "error", updatedAt: this.now().toISOString() };
      await this.deps.sales.update(failed).catch(() => undefined);
      throw new AppError("SALE_STATUS_UNKNOWN", { retryable: true });
    }
    const completed: Sale = { ...sale, writeStatus: "completed", updatedAt: this.now().toISOString() };
    await this.deps.sales.update(completed);
    return { sale: completed, items, idempotentReplay: false };
  }

  async findByRequestId(requestId: string): Promise<Sale | null> {
    return this.deps.sales.findByRequestId(requestId);
  }

  async challenge(saleId: string, input: unknown, staffAuthorized = false): Promise<{ sale: Sale; result: ChallengeResult }> {
    const parsed = challengeInputSchema.parse(input);
    return this.withKeyLock(`sale:${saleId}`, () => this.challengeLocked(saleId, parsed, staffAuthorized));
  }

  private async challengeLocked(saleId: string, parsed: { action: "start" } | { action: "stop"; elapsedMs: number } | { action: "skip" } | { action: "interrupt" }, staffAuthorized: boolean): Promise<{ sale: Sale; result: ChallengeResult }> {
    const sale = await this.deps.sales.findById(saleId);
    if (!sale) throw new AppError("NOT_FOUND");
    if (parsed.action === "skip" && !staffAuthorized) throw new AppError("UNAUTHORIZED");

    if (parsed.action === "start") {
      const nextStatus = this.transitionOrConflict(sale.experienceStatus, "start");
      const updated = { ...sale, experienceStatus: nextStatus, updatedAt: this.now().toISOString() };
      await this.deps.sales.update(updated);
      return { sale: updated, result: { result: "try", elapsedMs: null, stampCount: 1, messageKey: "try" } };
    }

    if (parsed.action === "stop") {
      const nextStatus = this.transitionOrConflict(sale.experienceStatus, "stop");
      const result = resultForElapsed(parsed.elapsedMs);
      const updated: Sale = { ...sale, experienceStatus: nextStatus, elapsedMs: parsed.elapsedMs, challengeSuccess: result.result === "success", stampCount: result.stampCount, updatedAt: this.now().toISOString() };
      await this.deps.sales.update(updated);
      return { sale: updated, result };
    }

    if (parsed.action === "skip") {
      const nextStatus = this.transitionOrConflict(sale.experienceStatus, "skip");
      const result = resultForSkip();
      const updated: Sale = { ...sale, experienceStatus: nextStatus, elapsedMs: null, challengeSuccess: false, stampCount: 1, updatedAt: this.now().toISOString() };
      await this.deps.sales.update(updated);
      return { sale: updated, result };
    }

    const nextStatus = this.transitionOrConflict(sale.experienceStatus, "interrupt");
    const result = resultForInterrupt();
    const updated: Sale = { ...sale, experienceStatus: nextStatus, elapsedMs: null, challengeSuccess: false, stampCount: 1, updatedAt: this.now().toISOString() };
    await this.deps.sales.update(updated);
    return { sale: updated, result };
  }

  async completion(saleId: string): Promise<{ saleId: string; stampCount: 1 | 2; result: string; elapsedMs: number | null }> {
    const sale = await this.deps.sales.findById(saleId);
    if (!sale) throw new AppError("NOT_FOUND");
    if (!sale.stampCount || sale.experienceStatus === "challenge_pending" || sale.experienceStatus === "challenge_started") {
      throw new AppError("CONFLICT");
    }
    return { saleId: sale.saleId, stampCount: sale.stampCount, result: sale.challengeSuccess ? "success" : sale.experienceStatus, elapsedMs: sale.elapsedMs };
  }

  private buildItem(saleId: string, input: SaleItemInput, productMap: Map<string, Product>): SaleItem {
    const product = productMap.get(input.productId);
    if (!product || product.status !== "active") throw new AppError("VALIDATION_ERROR");
    const lineTotal = calculateLineTotal(product.priceYen, input.quantity);
    return { saleItemId: randomUUID(), saleId, productId: product.productId, productNameSnapshot: product.name, unitPriceYen: product.priceYen, quantity: input.quantity, lineTotalYen: lineTotal, createdAt: this.now().toISOString() };
  }

  private transitionOrConflict(from: Sale["experienceStatus"], action: "start" | "stop" | "skip" | "interrupt"): Sale["experienceStatus"] {
    try {
      return transitionChallenge(from, action);
    } catch (error) {
      throw new AppError("CONFLICT", { cause: error });
    }
  }

  private async withKeyLock<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = sharedSaleLocks.get(key) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => { release = resolve; });
    sharedSaleLocks.set(key, current);
    await previous;
    try {
      return await task();
    } finally {
      release();
      if (sharedSaleLocks.get(key) === current) sharedSaleLocks.delete(key);
    }
  }
}

export function createGoogleSaleService(): SaleService {
  const env = getServerEnv();
  const credentials = env.GOOGLE_CLIENT_EMAIL && env.GOOGLE_PRIVATE_KEY
    ? { clientEmail: env.GOOGLE_CLIENT_EMAIL, privateKey: env.GOOGLE_PRIVATE_KEY }
    : undefined;
  const tokenProvider = credentials ? new GoogleAccessTokenProvider(credentials) : undefined;
  const sheets = new GoogleSheetsClient({ spreadsheetId: env.GOOGLE_SPREADSHEET_ID, tokenProvider });
  return new SaleService({
    products: new GoogleSheetsProductRepository(sheets),
    sales: new GoogleSheetsSaleRepository(sheets),
    settings: new GoogleSheetsSettingsRepository(sheets),
    events: new GoogleEventRepository(sheets),
  });
}

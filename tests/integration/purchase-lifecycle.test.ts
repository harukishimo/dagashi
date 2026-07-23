import { describe, expect, it } from "vitest";

import type { Product, RewardRedemption, Sale, SaleItem, Setting, AuditLog } from "@/domain/types";
import { AdminService } from "@/application/admin/service";
import type { AdminDataRepository } from "@/application/admin/data";
import { SaleService } from "@/application/sales/service";
import type { ProductRepository } from "@/infrastructure/google/repositories";
import type { SaleRepository } from "@/infrastructure/google/sales-repositories";

const productA: Product = {
  productId: "11111111-1111-4111-8111-111111111111",
  name: "テストチョコ",
  priceYen: 30,
  category: "チョコ",
  fallbackEmoji: "🍫",
  imageFileId: null,
  imageUpdatedAt: null,
  displayOrder: 1,
  status: "active",
  createdAt: "2026-07-23T00:00:00.000Z",
  updatedAt: "2026-07-23T00:00:00.000Z",
};

const productB: Product = {
  ...productA,
  productId: "22222222-2222-4222-8222-222222222222",
  name: "テストラムネ",
  priceYen: 50,
  category: "ラムネ",
  fallbackEmoji: "🫧",
};

class MemoryStore implements SaleRepository, AdminDataRepository {
  readonly sales = new Map<string, Sale>();
  readonly items: SaleItem[] = [];
  readonly rewards: RewardRedemption[] = [];
  readonly settings: Setting[] = [];
  readonly auditLogs: AuditLog[] = [];

  async findByRequestId(requestId: string): Promise<Sale | null> {
    return [...this.sales.values()].find((sale) => sale.requestId === requestId) ?? null;
  }

  async findById(saleId: string): Promise<Sale | null> {
    return this.sales.get(saleId) ?? null;
  }

  async appendPending(sale: Sale): Promise<void> {
    this.sales.set(sale.saleId, sale);
  }

  async appendItems(items: SaleItem[]): Promise<void> {
    this.items.push(...items);
  }

  async listItemsBySaleId(saleId: string): Promise<SaleItem[]> {
    return this.items.filter((item) => item.saleId === saleId);
  }

  async update(sale: Sale): Promise<void> {
    this.sales.set(sale.saleId, sale);
  }

  async listSales(): Promise<Sale[]> { return [...this.sales.values()]; }
  async listSaleItems(): Promise<SaleItem[]> { return [...this.items]; }
  async listRewards(): Promise<RewardRedemption[]> { return [...this.rewards]; }
  async listSettings(): Promise<Setting[]> { return [...this.settings]; }
  async findSaleById(saleId: string): Promise<Sale | null> { return this.findById(saleId); }

  async updateSale(sale: Sale): Promise<void> { await this.update(sale); }
  async appendReward(reward: RewardRedemption): Promise<void> { this.rewards.push(reward); }
  async appendAudit(log: AuditLog): Promise<void> { this.auditLogs.push(log); }
}

class MemoryProducts implements ProductRepository {
  constructor(private readonly values: Product[]) {}
  async listAll(): Promise<Product[]> { return [...this.values]; }
  async findById(productId: string): Promise<Product | null> { return this.values.find((product) => product.productId === productId) ?? null; }
  async create(product: Product): Promise<Product> { this.values.push(product); return product; }
  async update(product: Product): Promise<Product> {
    const index = this.values.findIndex((value) => value.productId === product.productId);
    if (index >= 0) this.values[index] = product;
    return product;
  }
}

const fixedNow = () => new Date("2026-07-23T03:00:00.000Z");

describe("purchase to admin reporting integration", () => {
  it("keeps price snapshots, awards challenge stamps, and excludes voided sales", async () => {
    const store = new MemoryStore();
    const products = new MemoryProducts([productA, productB]);
    const sales = new SaleService({ products, sales: store, now: fixedNow });
    const admin = new AdminService({
      data: store,
      products: { list: () => products.listAll(), get: async (id) => (await products.findById(id)) ?? (() => { throw new Error("not found"); })() },
      now: fixedNow,
      timeZone: "Asia/Tokyo",
    });

    const created = await sales.create({
      requestId: "33333333-3333-4333-8333-333333333333",
      paymentMethod: "cash",
      items: [{ productId: productA.productId, quantity: 2 }, { productId: productB.productId, quantity: 1 }],
    });
    expect(created.sale.totalYen).toBe(110);
    expect(created.items.map((item) => item.unitPriceYen)).toEqual([30, 50]);
    await sales.challenge(created.sale.saleId, { action: "start" });
    const challenge = await sales.challenge(created.sale.saleId, { action: "stop", elapsedMs: 10_000 });
    expect(challenge.result.stampCount).toBe(2);

    const second = await sales.create({
      requestId: "44444444-4444-4444-8444-444444444444",
      paymentMethod: "cash",
      items: [{ productId: productA.productId, quantity: 1 }],
    });
    await sales.challenge(second.sale.saleId, { action: "skip" }, true);
    await admin.voidSale(second.sale.saleId, "テスト取消");
    await admin.redeemReward(productB.productId);

    const dashboard = await admin.dashboard("2026-07-23");
    expect(dashboard.totalYen).toBe(110);
    expect(dashboard.saleCount).toBe(1);
    expect(dashboard.itemCount).toBe(3);
    expect(dashboard.voidCount).toBe(1);
    expect(dashboard.rewardCount).toBe(1);
    expect(store.auditLogs.map((log) => log.action)).toEqual(["sale.void", "reward.redeem"]);
  });

  it("replays a duplicate request without adding another sale or line item", async () => {
    const store = new MemoryStore();
    const sales = new SaleService({ products: new MemoryProducts([productA]), sales: store, now: fixedNow });
    const input = { requestId: "55555555-5555-4555-8555-555555555555", paymentMethod: "cash" as const, items: [{ productId: productA.productId, quantity: 1 }] };
    const first = await sales.create(input);
    const replay = await sales.create(input);
    expect(replay.idempotentReplay).toBe(true);
    expect(replay.sale.saleId).toBe(first.sale.saleId);
    expect(store.sales.size).toBe(1);
    expect(store.items).toHaveLength(1);
  });
});

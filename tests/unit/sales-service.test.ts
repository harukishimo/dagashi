import { describe, expect, it } from "vitest";
import { SaleService } from "@/application/sales/service";
import type { Product, Sale, SaleItem, Setting } from "@/domain/types";
import type { ProductRepository, SettingsRepository } from "@/infrastructure/google/repositories";
import type { SaleRepository } from "@/infrastructure/google/sales-repositories";

const product: Product = {
  productId: "11111111-1111-4111-8111-111111111111", name: "テストチョコ", priceYen: 30, category: "チョコ", fallbackEmoji: "🍫", imageFileId: null, imageUpdatedAt: null, displayOrder: 1, status: "active", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
};

class MemoryProducts implements ProductRepository {
  async listAll(): Promise<Product[]> { return [product]; }
  async findById(id: string): Promise<Product | null> { return id === product.productId ? product : null; }
  async create(value: Product): Promise<Product> { return value; }
  async update(value: Product): Promise<Product> { return value; }
}

class MemorySales implements SaleRepository {
  sales = new Map<string, Sale>();
  items: SaleItem[] = [];
  async findByRequestId(requestId: string): Promise<Sale | null> { return [...this.sales.values()].find((sale) => sale.requestId === requestId) ?? null; }
  async findById(saleId: string): Promise<Sale | null> { return this.sales.get(saleId) ?? null; }
  async appendPending(sale: Sale): Promise<void> { this.sales.set(sale.saleId, sale); }
  async appendItems(items: SaleItem[]): Promise<void> { this.items.push(...items); }
  async listItemsBySaleId(saleId: string): Promise<SaleItem[]> { return this.items.filter((item) => item.saleId === saleId); }
  async update(sale: Sale): Promise<void> { this.sales.set(sale.saleId, sale); }
}

class MemorySettings implements SettingsRepository {
  constructor(private readonly shopEnabled: string) {}
  async list(): Promise<Setting[]> { return [{ key: "shop_enabled", value: this.shopEnabled, updatedAt: "2026-01-01T00:00:00.000Z" }]; }
  async find(key: string): Promise<Setting | null> { return key === "shop_enabled" ? (await this.list())[0] : null; }
}

const fixedNow = () => new Date("2026-01-01T00:00:00.000Z");

describe("SaleService", () => {
  it("stores one completed sale and replays the same request id", async () => {
    const sales = new MemorySales();
    const service = new SaleService({ products: new MemoryProducts(), sales, now: fixedNow });
    const input = { requestId: "22222222-2222-4222-8222-222222222222", paymentMethod: "cash" as const, items: [{ productId: product.productId, quantity: 2 }] };
    const first = await service.create(input);
    const replay = await service.create(input);
    expect(first.sale.totalYen).toBe(60);
    expect(first.sale.writeStatus).toBe("completed");
    expect(replay.idempotentReplay).toBe(true);
    expect(sales.sales.size).toBe(1);
  });

  it("serializes parallel creates for the same request id", async () => {
    const sales = new MemorySales();
    const service = new SaleService({ products: new MemoryProducts(), sales, now: fixedNow });
    const input = { requestId: "44444444-4444-4444-8444-444444444444", paymentMethod: "cash" as const, items: [{ productId: product.productId, quantity: 1 }] };
    const results = await Promise.all([service.create(input), service.create(input)]);
    expect(sales.sales.size).toBe(1);
    expect(results.filter((result) => result.idempotentReplay)).toHaveLength(1);
  });

  it("serializes parallel creates from separate route service instances", async () => {
    const sales = new MemorySales();
    const serviceFromFirstRequest = new SaleService({ products: new MemoryProducts(), sales, now: fixedNow });
    const serviceFromSecondRequest = new SaleService({ products: new MemoryProducts(), sales, now: fixedNow });
    const input = { requestId: "66666666-6666-4666-8666-666666666666", paymentMethod: "cash" as const, items: [{ productId: product.productId, quantity: 1 }] };
    const results = await Promise.all([serviceFromFirstRequest.create(input), serviceFromSecondRequest.create(input)]);
    expect(sales.sales.size).toBe(1);
    expect(results.filter((result) => result.idempotentReplay)).toHaveLength(1);
  });

  it("rejects payment confirmation while shop_enabled is false", async () => {
    const service = new SaleService({ products: new MemoryProducts(), sales: new MemorySales(), settings: new MemorySettings("false"), now: fixedNow });
    await expect(service.create({ requestId: "88888888-8888-4888-8888-888888888888", paymentMethod: "cash", items: [{ productId: product.productId, quantity: 1 }] })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("accepts only the 9500-10500ms success boundary and gives one stamp otherwise", async () => {
    const service = new SaleService({ products: new MemoryProducts(), sales: new MemorySales(), now: fixedNow });
    for (const [elapsedMs, expectedStamp] of [[9_499, 1], [9_500, 2], [10_500, 2], [10_501, 1]] as const) {
      const requestId = `33333333-3333-4333-8333-${String(elapsedMs).padStart(12, "0")}`;
      const created = await service.create({ requestId, paymentMethod: "cash", items: [{ productId: product.productId, quantity: 1 }] });
      await service.challenge(created.sale.saleId, { action: "start" });
      const result = await service.challenge(created.sale.saleId, { action: "stop", elapsedMs });
      expect(result.result.stampCount).toBe(expectedStamp);
    }
  });

  it("accepts only one of two parallel stop operations", async () => {
    const sales = new MemorySales();
    const service = new SaleService({ products: new MemoryProducts(), sales, now: fixedNow });
    const created = await service.create({ requestId: "55555555-5555-4555-8555-555555555555", paymentMethod: "cash", items: [{ productId: product.productId, quantity: 1 }] });
    await service.challenge(created.sale.saleId, { action: "start" });
    const results = await Promise.allSettled([service.challenge(created.sale.saleId, { action: "stop", elapsedMs: 10_000 }), service.challenge(created.sale.saleId, { action: "stop", elapsedMs: 10_000 })]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
  });

  it("serializes parallel stop operations from separate route service instances", async () => {
    const sales = new MemorySales();
    const firstService = new SaleService({ products: new MemoryProducts(), sales, now: fixedNow });
    const secondService = new SaleService({ products: new MemoryProducts(), sales, now: fixedNow });
    const created = await firstService.create({ requestId: "77777777-7777-4777-8777-777777777777", paymentMethod: "cash", items: [{ productId: product.productId, quantity: 1 }] });
    await firstService.challenge(created.sale.saleId, { action: "start" });
    const results = await Promise.allSettled([
      firstService.challenge(created.sale.saleId, { action: "stop", elapsedMs: 10_000 }),
      secondService.challenge(created.sale.saleId, { action: "stop", elapsedMs: 10_000 }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
  });
});

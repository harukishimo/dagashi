import { describe, it, expect, vi } from "vitest";
import { MANUAL_HEADERS, parseManualSales } from "@/infrastructure/google/manual-sales";
import { GoogleAdminDataRepository } from "@/application/admin/data";
import { inventoryConsumption, SHEET_HEADERS } from "@/infrastructure/google/repositories";
import { AdminService } from "@/application/admin/service";
import { EventsService } from "@/application/admin/events-service";
import { buildSalesBreakdown } from "@/domain/sales-breakdown";

const productId = "51f4d4db-0e80-4f5b-b568-7b4fe118efb0";
const event = { eventId: productId, name: "テストイベント", startDate: "2026-09-18", endDate: "2026-09-18", createdAt: "2026-09-01T00:00:00Z" };
const row = ["MS-0002", "確定", "2026-09-18 00:00:00", `カルパス [${productId}]`, "15", "2", "999", ""];
describe("manual sales", () => {
  it("calculates from unit price/quantity, uses JST and keeps stable identities", () => {
    const a = parseManualSales([MANUAL_HEADERS, row], [event]);
    expect(a.sales[0]).toMatchObject({ totalYen: 30, eventId: productId, soldAt: "2026-09-17T15:00:00.000Z", source: "manual" });
    expect(parseManualSales([MANUAL_HEADERS, [], row], [event])).toEqual(a);
    expect(a.items[0]).toMatchObject({ productNameSnapshot: "カルパス", quantity: 2, lineTotalYen: 30 });
  });
  it("excludes drafts, samples, cancellations and empty prepared rows", () => {
    for (const state of ["", "下書き", "サンプル", "取消"]) expect(parseManualSales([MANUAL_HEADERS, [row[0], state]], []).sales).toEqual([]);
  });
  it("rejects duplicate confirmed IDs and malformed confirmed data", () => {
    expect(() => parseManualSales([MANUAL_HEADERS, row, row], [])).toThrow();
    for (const [index, value] of [[2, "2026-02-30 00:00:00"], [2, "2026-09-18 24:00:00"], [4, ""], [4, "-1"], [5, "1.5"], [5, "0"], [3, "未知の商品"], [0, ""]] as const) {
      const bad = [...row]; bad[index] = value;
      expect(() => parseManualSales([MANUAL_HEADERS, bad], [])).toThrow();
    }
  });
  it("integrates dashboard, event totals, breakdown and inventory without any writes", async () => {
    let state = "確定";
    const client = { getValues: vi.fn(async (range: string) => ({ values:
      range.startsWith("'手入力売上'") ? [MANUAL_HEADERS, [row[0], state, ...row.slice(2)]] :
      range.startsWith("events!") ? [["event_id", "name", "start_date", "end_date", "created_at"], [event.eventId, event.name, event.startDate, event.endDate, event.createdAt]] :
      range.startsWith("sale_items!") ? [SHEET_HEADERS.sale_items] :
      range.startsWith("sales!") ? [SHEET_HEADERS.sales] : [SHEET_HEADERS.reward_redemptions]
    })), appendValues: vi.fn(), updateValues: vi.fn() };
    const data = new GoogleAdminDataRepository(client as never);
    const service = new AdminService({ data, products: {} as never });
    expect(await service.dashboard("2026-09-18")).toMatchObject({ totalYen: 30, itemCount: 2, saleCount: 1 });
    expect((await new EventsService({ list: async () => [event], append: vi.fn() }, data).list())[0].totalYen).toBe(30);
    expect(buildSalesBreakdown((await service.sales()).sales)).toMatchObject({ totalYen: 30, totalQuantity: 2 });
    expect((await inventoryConsumption(client as never)).get(productId)).toBe(2);
    expect((await inventoryConsumption(client as never)).get(productId)).toBe(2);
    await expect(service.voidSale("manual-MS-0002", "取消")).rejects.toMatchObject({ code: "CONFLICT" });
    state = "取消";
    expect((await inventoryConsumption(client as never)).get(productId)).toBeUndefined();
    expect((await service.dashboard("2026-09-18")).totalYen).toBe(0);
    expect(client.appendValues).not.toHaveBeenCalled(); expect(client.updateValues).not.toHaveBeenCalled();
  });
});

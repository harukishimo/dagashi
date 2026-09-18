import { describe, expect, it, vi } from "vitest";
import { eventInputSchema, eventForSale, assertNoEventOverlap } from "@/domain/events";
import { assertSalesHeader, saleRow, toSale, GoogleSheetsSaleRepository } from "@/infrastructure/google/sales-repositories";
import { SHEET_HEADERS } from "@/infrastructure/google/repositories";
import { GoogleAdminDataRepository } from "@/application/admin/data";
import { EventsService } from "@/application/admin/events-service";
import { GoogleEventRepository, EVENT_HEADERS } from "@/infrastructure/google/event-repository";
import type { SalesEvent, Sale } from "@/domain/types";

const event: SalesEvent = { eventId: "11111111-1111-4111-8111-111111111111", name: "秋祭り", startDate: "2026-09-18", endDate: "2026-09-19", createdAt: "2026-09-01T00:00:00.000Z" };
const sale: Sale = { saleId: "22222222-2222-4222-8222-222222222222", requestId: "33333333-3333-4333-8333-333333333333", soldAt: "2026-09-18T00:00:00Z", writeStatus: "completed", saleStatus: "completed", totalYen: 100, paymentMethod: "cash", experienceStatus: "skipped", stampCount: 1, challengeSuccess: false, elapsedMs: null, voidedAt: null, voidReason: null, createdAt: "2026-09-18T00:00:00Z", updatedAt: "2026-09-18T00:00:00Z", eventId: event.eventId, eventNameSnapshot: event.name };

describe("events", () => {
  it("validates actual calendar dates and ordering", () => {
    expect(eventInputSchema.safeParse({ name: "a", startDate: "2026-02-30", endDate: "2026-03-01" }).success).toBe(false);
    expect(eventInputSchema.safeParse({ name: "a", startDate: "2026-09-20", endDate: "2026-09-19" }).success).toBe(false);
  });
  it("uses inclusive Japan dates with exact UTC boundaries", () => {
    expect(eventForSale([event], "2026-09-17T14:59:59.999Z")).toBeNull();
    expect(eventForSale([event], "2026-09-17T15:00:00.000Z")).toEqual(event);
    expect(eventForSale([event], "2026-09-19T14:59:59.999Z")).toEqual(event);
    expect(eventForSale([event], "2026-09-19T15:00:00.000Z")).toBeNull();
  });
  it("rejects overlap including one shared boundary date", () => {
    expect(() => assertNoEventOverlap([event], { startDate: "2026-09-19", endDate: "2026-09-20" })).toThrow();
    expect(() => assertNoEventOverlap([event], { startDate: "2026-09-20", endDate: "2026-09-20" })).not.toThrow();
    expect(() => eventForSale([event, event], sale.soldAt)).toThrow();
  });
  it("ignores archived events for matching and overlap", () => {
    const archived = { ...event, status: "archived" as const };
    expect(eventForSale([archived], sale.soldAt)).toBeNull();
    expect(() => assertNoEventOverlap([archived], event)).not.toThrow();
  });
  it("preserves event snapshot and reads legacy 15-column rows", () => {
    expect(toSale(saleRow(sale), 2)).toMatchObject({ eventId: event.eventId, eventNameSnapshot: event.name });
    expect(toSale(saleRow(sale).slice(0, 15), 2)).toMatchObject({ eventId: null, eventNameSnapshot: null });
    expect(() => assertSalesHeader([...SHEET_HEADERS.sales])).not.toThrow();
    expect(() => assertSalesHeader([...SHEET_HEADERS.sales], true)).toThrow();
    expect(() => toSale(saleRow(sale).slice(0, 16), 2)).toThrow();
  });
  it("retains event columns when sale status changes in either repository", async () => {
    const client = { getValues: vi.fn(async () => ({ values: [[...SHEET_HEADERS.sales, "event_id", "event_name_snapshot"], saleRow(sale)] })), updateValues: vi.fn(async () => undefined) };
    const updated = { ...sale, saleStatus: "voided" as const };
    await new GoogleAdminDataRepository(client as never).updateSale(updated);
    expect(client.updateValues).toHaveBeenLastCalledWith("sales!A2:Q2", [saleRow(updated)]);
    await new GoogleSheetsSaleRepository(client as never).update(updated);
    expect(client.updateValues).toHaveBeenLastCalledWith("sales!A2:Q2", [saleRow(updated)]);
  });
  it("summarizes only counted sales and keeps archived history", async () => {
    const service = new EventsService({ list: async () => [{ ...event, status: "archived" }], append: async () => undefined }, { listSales: async () => [sale, { ...sale, writeStatus: "pending" }, { ...sale, saleStatus: "voided" }, { ...sale, eventId: null }] } as never);
    expect(await service.list()).toMatchObject([{ status: "archived", saleCount: 1, totalYen: 100 }]);
  });
  it("serializes event registration and rejects second overlap", async () => {
    const events: SalesEvent[] = [];
    const repository = { list: async () => [...events], append: async (value: SalesEvent) => { events.push(value); } };
    const service = new EventsService(repository, {} as never);
    const input = { name: event.name, startDate: event.startDate, endDate: event.endDate };
    const results = await Promise.allSettled([service.create(input), service.create(input)]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(events).toHaveLength(1);
  });
  it("rejects events beyond the readable limit", async () => {
    const append = vi.fn();
    const service = new EventsService({ list: async () => Array.from({ length: 999 }, () => event), append }, {} as never);
    await expect(service.create({ name: "次", startDate: "2027-01-01", endDate: "2027-01-01" })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(append).not.toHaveBeenCalled();
  });
  it("archives only the event status cell", async () => {
    const client = { getValues: vi.fn(async () => ({ values: [[...EVENT_HEADERS], [event.eventId, event.name, event.startDate, event.endDate, event.createdAt, "active"]] })), updateValues: vi.fn(async () => undefined) };
    await new GoogleEventRepository(client as never).archive(event.eventId);
    expect(client.updateValues).toHaveBeenCalledWith("events!F2", [["archived"]]);
  });
});

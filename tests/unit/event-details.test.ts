import { describe, it, expect, vi } from "vitest";
import { eventDetailsSchema } from "@/domain/events";
import { GoogleEventRepository, EVENT_HEADERS } from "@/infrastructure/google/event-repository";
import { EventsService } from "@/application/admin/events-service";

const id = "2d50a4db-d1d4-4f90-9177-86708b6ee99b";
const details = { description: "地域イベント", ageRange: "3〜12歳", targetAudience: "親子連れ", expectedAttendance: 100 };
describe("event details editing", () => {
  it("updates only G:J, preserving identity, dates and archived state", async () => {
    const client = { getValues: vi.fn().mockResolvedValue({ values: [EVENT_HEADERS, [id, "既存", "2026-09-18", "2026-09-18", "2026-09-01T00:00:00Z", "archived"]] }), updateValues: vi.fn() };
    await new GoogleEventRepository(client as never).updateDetails(id, details);
    expect(client.updateValues).toHaveBeenCalledExactlyOnceWith("events!G2:J2", [["地域イベント", "3〜12歳", "親子連れ", "100"]]);
  });
  it("supports clearing optional details", async () => {
    const updateDetails = vi.fn();
    const service = new EventsService({ list: vi.fn(), append: vi.fn(), updateDetails }, {} as never);
    await service.updateDetails(id, { description: "", ageRange: "", targetAudience: "", expectedAttendance: null });
    expect(updateDetails).toHaveBeenCalledWith(id, { description: "", ageRange: "", targetAudience: "", expectedAttendance: null });
  });
  it("rejects unintended fields, missing fields and invalid attendance", () => {
    for (const change of [{ status: "archived" }, { startDate: "2026-10-01" }, { expectedAttendance: -1 }, { expectedAttendance: 1.5 }, { targetAudience: "x".repeat(501) }]) expect(eventDetailsSchema.safeParse({ ...details, ...change }).success).toBe(false);
    expect(eventDetailsSchema.safeParse({}).success).toBe(false);
  });
  it("does not write when the ID is missing", async () => {
    const client = { getValues: vi.fn().mockResolvedValue({ values: [EVENT_HEADERS] }), updateValues: vi.fn() };
    await expect(new GoogleEventRepository(client as never).updateDetails(id, details)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(client.updateValues).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from "vitest";
import { AdminSettingsService } from "@/application/admin/settings-service";
import { SHEET_HEADERS } from "@/infrastructure/google/repositories";

function fixture(extra: string[][] = []) {
  const client = { getValues: vi.fn(async () => ({ values: [[...SHEET_HEADERS.settings], ...extra] })), updateValues: vi.fn(async () => undefined), appendValues: vi.fn(async () => undefined) };
  return { client, service: new AdminSettingsService(client as never, () => new Date("2026-09-18T00:00:00Z")) };
}

describe("challenge setting", () => {
  it("defaults to on without migrating older sheets on read", async () => {
    const { service, client } = fixture();
    expect((await service.read()).settings.challenge_enabled).toBe("true");
    expect(client.appendValues).not.toHaveBeenCalled();
  });
  it("refuses to append an absent key to avoid multi-instance duplicate rows", async () => {
    const { service, client } = fixture();
    await expect(service.update({ challenge_enabled: false })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(client.appendValues).not.toHaveBeenCalled();
    expect(client.updateValues).not.toHaveBeenCalled();
  });
  it("updates only the existing toggle row", async () => {
    const { service, client } = fixture([["shop_enabled", "true", ""], ["challenge_enabled", "true", ""]]);
    await service.update({ challenge_enabled: "false" });
    expect(client.updateValues).toHaveBeenCalledWith("settings!A3:C3", [["challenge_enabled", "false", "2026-09-18T00:00:00.000Z"]]);
    expect(client.appendValues).toHaveBeenCalledWith("audit_logs!A:F", expect.any(Array));
  });
  it("rejects duplicate rows and invalid or mixed settings without writes", async () => {
    const { service, client } = fixture([["challenge_enabled", "true", ""], ["challenge_enabled", "false", ""]]);
    await expect(service.update({ challenge_enabled: true })).rejects.toMatchObject({ code: "SHEETS_UNAVAILABLE" });
    await expect(service.update({ challenge_enabled: "off" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(service.update({ challenge_enabled: true, challenge_timeout_ms: 4 })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(client.updateValues).not.toHaveBeenCalled();
    expect(client.appendValues).not.toHaveBeenCalled();
  });
});

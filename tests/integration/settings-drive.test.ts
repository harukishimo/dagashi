import { describe, expect, it, vi } from "vitest";

import { AdminSettingsService, filterAdminSettings } from "@/application/admin/settings-service";
import type { Setting } from "@/domain/types";
import { GoogleDriveImageClient } from "@/infrastructure/google/drive-client";
import { createOpaqueImageEtag } from "@/infrastructure/google/image-etag";
import { SHEET_HEADERS } from "@/infrastructure/google/repositories";

describe("protected settings and Drive image integration", () => {
  it("uses an opaque product ETag instead of an upstream Drive ETag or file ID", () => {
    const etag = createOpaqueImageEtag("product-1", "2026-07-23T00:00:00.000Z", "image/png");
    expect(etag).toMatch(/^"[a-f0-9]{64}"$/);
    expect(etag).not.toContain("file-1");
    expect(etag).not.toContain("upstream-etag");
  });

  it("returns only allowlisted settings and keeps runtime updates disabled", async () => {
    const values = [
      [...SHEET_HEADERS.settings],
      ["schema_version", "2", "2026-07-23T00:00:00.000Z"],
      ["challenge_success_min_ms", "9500", "2026-07-23T00:00:00.000Z"],
      ["challenge_success_max_ms", "10500", "2026-07-23T00:00:00.000Z"],
      ["session_secret", "do-not-return", "2026-07-23T00:00:00.000Z"],
    ];
    const client = {
      getValues: vi.fn(async () => ({ values })),
      appendValues: vi.fn(async () => undefined),
      updateValues: vi.fn(async () => undefined),
    };
    const service = new AdminSettingsService(client as never, () => new Date("2026-07-23T03:00:00.000Z"));
    await expect(service.read()).resolves.toMatchObject({ settings: { challenge_success_min_ms: "9500", challenge_success_max_ms: "10500" }, schemaVersion: "2" });
    expect(filterAdminSettings([{ key: "session_secret", value: "secret", updatedAt: "" } as Setting])).toEqual({});
    await expect(service.update({ schema_version: "99" })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(service.update({ challenge_success_min_ms: "11000" })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("checks Drive parent and MIME before serving content, preserving ETag metadata", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.includes("fields=id,name,mimeType")) {
        return new Response(JSON.stringify({ id: "file-1", name: "candy.png", mimeType: "image/png", size: "4", modifiedTime: "2026-07-23T00:00:00Z", parents: ["folder-1"], trashed: false }), { status: 200 });
      }
      return new Response(new Uint8Array([1, 2, 3, 4]), { status: 200, headers: { "content-type": "image/png", etag: '"v1"' } });
    });
    const drive = new GoogleDriveImageClient({ folderId: "folder-1", tokenProvider: { getToken: vi.fn(async () => "token") } as never, fetchImpl });
    await expect(drive.download("file-1")).resolves.toMatchObject({ contentType: "image/png", etag: '"v1"' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    const wrongMime = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.includes("fields=id,name,mimeType")) return new Response(JSON.stringify({ id: "file-1", name: "candy.svg", mimeType: "image/svg+xml", size: "4", modifiedTime: "2026-07-23T00:00:00Z", parents: ["folder-1"], trashed: false }), { status: 200 });
      return new Response(new Uint8Array([1]), { status: 200, headers: { "content-type": "image/svg+xml" } });
    });
    const unsafeDrive = new GoogleDriveImageClient({ folderId: "folder-1", tokenProvider: { getToken: vi.fn(async () => "token") } as never, fetchImpl: wrongMime });
    await expect(unsafeDrive.download("file-1")).rejects.toMatchObject({ code: "DRIVE_IMAGE_UNAVAILABLE", status: 422 });
    expect(wrongMime).toHaveBeenCalledTimes(1);
  });
});

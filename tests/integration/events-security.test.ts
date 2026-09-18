import { describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/admin/events/route";
import { PATCH } from "@/app/api/admin/events/[eventId]/route";
import * as session from "@/application/admin/require-admin-session";

describe("events admin authorization", () => {
  it("rejects foreign-origin mutations before accessing data", async () => {
    const headers = { origin: "https://evil.test", host: "example.test", cookie: "session=untrusted" };
    expect((await POST(new Request("https://example.test/api/admin/events", { method: "POST", headers }))).status).toBe(401);
    expect((await PATCH(new Request("https://example.test/api/admin/events/id", { method: "PATCH", headers }), { params: Promise.resolve({ eventId: "id" }) })).status).toBe(401);
  });
  it("rejects unauthenticated reads, creates and archives", async () => {
    expect((await GET(new Request("https://example.test/api/admin/events"))).status).toBe(401);
    expect((await POST(new Request("https://example.test/api/admin/events", { method: "POST" }))).status).toBe(401);
    expect((await PATCH(new Request("https://example.test/api/admin/events/id", { method: "PATCH" }), { params: Promise.resolve({ eventId: "id" }) })).status).toBe(401);
  });
  it("requires origin checks on both mutation handlers", async () => {
    const guard = vi.spyOn(session, "requireAdminSession").mockResolvedValue(false);
    try {
      const request = new Request("https://example.test/api/admin/events", { method: "POST" });
      await POST(request);
      expect(guard).toHaveBeenLastCalledWith(request, { requireOrigin: true });
      await PATCH(request, { params: Promise.resolve({ eventId: "id" }) });
      expect(guard).toHaveBeenLastCalledWith(request, { requireOrigin: true });
    } finally { guard.mockRestore(); }
  });
});

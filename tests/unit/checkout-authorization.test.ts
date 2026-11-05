import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as SessionAuth from "@/application/admin/require-admin-session";
const mocked = vi.hoisted(() => ({ pin: true, authenticated: false, create: vi.fn(), lookup: vi.fn() }));
vi.mock("@/application/operation-settings", () => ({ readOperationSettings: vi.fn(async () => ({ checkoutPinRequired: mocked.pin })) }));
vi.mock("@/application/admin/require-admin-session", async importOriginal => {
  const actual = await importOriginal<typeof SessionAuth>();
  return { ...actual, requireAdminSession: vi.fn(async () => mocked.authenticated), refreshAdminSessionCookie: (_request: Request, response: Response) => response };
});
vi.mock("@/application/sales/service", () => ({ createGoogleSaleService: () => ({ create: mocked.create, findByRequestId: mocked.lookup }) }));
import { POST } from "@/app/api/sales/route";
import { GET } from "@/app/api/sales/by-request/[requestId]/route";

const headers = { origin: "https://example.test", host: "example.test", "content-type": "application/json" };
beforeEach(() => { mocked.pin = true; mocked.authenticated = false; mocked.create.mockReset(); mocked.lookup.mockReset(); mocked.create.mockResolvedValue({ sale: { saleId: "saved" } }); mocked.lookup.mockResolvedValue(null); });
describe("configurable checkout authorization", () => {
  it("rejects a missing PIN session by default", async () => {
    const result = await POST(new Request("https://example.test/api/sales", { method: "POST", headers, body: "{}" }));
    expect(result.status).toBe(401); expect(mocked.create).not.toHaveBeenCalled();
  });
  it("accepts the same-origin payment and recovery when PIN is disabled", async () => {
    mocked.pin = false;
    expect((await POST(new Request("https://example.test/api/sales", { method: "POST", headers, body: "{}" }))).status).toBe(200);
    expect((await GET(new Request("https://example.test/api/sales/by-request/id", { headers }), { params: Promise.resolve({ requestId: "id" }) })).status).toBe(200);
  });
  it("still rejects foreign-origin payments and recovery with PIN disabled", async () => {
    mocked.pin = false;
    const foreign = { ...headers, origin: "https://foreign.test" };
    expect((await POST(new Request("https://example.test/api/sales", { method: "POST", headers: foreign, body: "{}" }))).status).toBe(401);
    expect((await GET(new Request("https://example.test/api/sales/by-request/id", { headers: foreign }), { params: Promise.resolve({ requestId: "id" }) })).status).toBe(401);
    expect(mocked.create).not.toHaveBeenCalled(); expect(mocked.lookup).not.toHaveBeenCalled();
  });
});

import { describe, expect, it } from "vitest";
import { POST as postSale } from "@/app/api/sales/route";
import { PATCH as patchChallenge } from "@/app/api/sales/[saleId]/challenge/route";
import { POST as postComplete } from "@/app/api/sales/[saleId]/complete/route";

const saleId = "11111111-1111-4111-8111-111111111111";

describe("state-changing sales route Origin guard", () => {
  it("rejects a payment without Origin before attempting Google access", async () => {
    const response = await postSale(new Request("https://example.test/api/sales", { method: "POST", body: "{}" }));
    expect(response.status).toBe(401);
  });

  it("rejects challenge and completion from a foreign Origin", async () => {
    const headers = { "content-type": "application/json", origin: "https://attacker.test", host: "example.test" };
    const challenge = await patchChallenge(new Request(`https://example.test/api/sales/${saleId}/challenge`, { method: "PATCH", headers, body: JSON.stringify({ action: "stop", elapsedMs: 10_000 }) }), { params: Promise.resolve({ saleId }) });
    const complete = await postComplete(new Request(`https://example.test/api/sales/${saleId}/complete`, { method: "POST", headers }), { params: Promise.resolve({ saleId }) });
    expect(challenge.status).toBe(403);
    expect(complete.status).toBe(403);
  });
});

import { describe, expect, it } from "vitest";

import { GET as getSettings, PATCH as patchSettings } from "@/app/api/admin/settings/route";

describe("admin route security boundary", () => {
  it("does not disclose settings to an unauthenticated browser", async () => {
    const request = new Request("https://example.test/api/admin/settings");
    const response = await getSettings(request);
    expect(response.status).toBe(401);
    expect(await response.text()).not.toContain("schema_version");
  });

  it("rejects unauthenticated state-changing settings requests", async () => {
    const request = new Request("https://example.test/api/admin/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json", origin: "https://example.test", host: "example.test" },
      body: JSON.stringify({ key: "shop_enabled", value: "false" }),
    });
    const response = await patchSettings(request);
    expect(response.status).toBe(401);
    expect(await response.text()).not.toContain("shop_enabled");
  });
});

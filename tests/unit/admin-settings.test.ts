import { describe, expect, it } from "vitest";

import { filterAdminSettings, validateAdminSettingValue } from "@/application/admin/settings-service";

describe("admin settings allowlist", () => {
  it("returns only public operational settings", () => {
    expect(filterAdminSettings([
      { key: "schema_version", value: "2", updatedAt: "" },
      { key: "challenge_success_min_ms", value: "9500", updatedAt: "" },
      { key: "ADMIN_PIN_HASH", value: "secret", updatedAt: "" },
    ])).toEqual({ challenge_success_min_ms: "9500" });
  });

  it("validates numeric and boolean values", () => {
    expect(validateAdminSettingValue("challenge_success_min_ms", "9500")).toBe("9500");
    expect(validateAdminSettingValue("shop_enabled", false)).toBe("false");
    expect(validateAdminSettingValue("challenge_enabled", false)).toBe("false");
    expect(() => validateAdminSettingValue("challenge_enabled", "off")).toThrow();
    expect(() => validateAdminSettingValue("challenge_success_min_ms", "-1")).toThrow();
    expect(() => validateAdminSettingValue("shop_enabled", "yes")).toThrow();
    expect(() => validateAdminSettingValue("schema_version", "3")).toThrow();
    expect(() => validateAdminSettingValue("ADMIN_PIN_HASH", "secret")).toThrow();
  });
});

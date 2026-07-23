import { describe, expect, it } from "vitest";
import { withImageVersion } from "@/components/child/ProductVisual";

describe("ProductVisual image URL", () => {
  it("does not create duplicate question marks when the API URL already has a query", () => {
    expect(withImageVersion("/api/product-images/p-1?v=old", "new value")).toBe("/api/product-images/p-1?v=old");
  });

  it("adds a cache-busting query only when a version exists", () => {
    expect(withImageVersion("/api/product-images/p-1", null)).toBe("/api/product-images/p-1");
  });
});

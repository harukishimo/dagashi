import { describe, expect, it } from "vitest";
import { formatLiveElapsed } from "@/components/child/challenge-display";

describe("challenge live timer display", () => {
  it("shows 4.99 at 4999ms without rounding into 5.00", () => {
    expect(formatLiveElapsed(4_999)).toBe("4.99");
  });

  it("does not render a number from 5000ms onward", () => {
    expect(formatLiveElapsed(5_000)).toBeNull();
    expect(formatLiveElapsed(60_000)).toBeNull();
  });
});

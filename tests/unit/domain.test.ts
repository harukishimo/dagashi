import { describe, expect, it } from "vitest";

import {
  calculateLineTotal,
  calculateSaleTotal,
  formatChallengeElapsed,
  isChallengeSuccess,
  isSingleEmojiGraphemeCluster,
  liveChallengeElapsed,
  shouldHideLiveElapsed,
  stampCountForChallenge,
} from "@/domain";

describe("domain calculations", () => {
  it("calculates integer line and sale totals", () => {
    expect(calculateLineTotal(30, 2)).toBe(60);
    expect(calculateSaleTotal([{ unitPriceYen: 30, quantity: 2 }, { unitPriceYen: 50, quantity: 1 }])).toBe(110);
  });

  it("rejects invalid quantities", () => {
    expect(() => calculateLineTotal(30, 0)).toThrow();
    expect(() => calculateLineTotal(-1, 1)).toThrow();
  });
});

describe("challenge", () => {
  it.each([
    [9_499, false],
    [9_500, true],
    [10_500, true],
    [10_501, false],
  ])("uses unrounded milliseconds for %ims", (elapsedMs, expected) => {
    expect(isChallengeSuccess(elapsedMs)).toBe(expected);
  });

  it("awards two stamps only for success", () => {
    expect(stampCountForChallenge(10_000, "completed")).toBe(2);
    expect(stampCountForChallenge(8_000, "completed")).toBe(1);
    expect(stampCountForChallenge(null, "skipped")).toBe(1);
    expect(stampCountForChallenge(null, "interrupted")).toBe(1);
  });

  it("hides the live number at exactly five seconds but keeps result formatting", () => {
    expect(liveChallengeElapsed(4_999)).toBe("4.99");
    expect(shouldHideLiveElapsed(4_999)).toBe(false);
    expect(liveChallengeElapsed(5_000)).toBeNull();
    expect(shouldHideLiveElapsed(5_000)).toBe(true);
    expect(formatChallengeElapsed(10_000)).toBe("10.00");
  });
});

describe("fallback emoji validation", () => {
  it.each(["🍫", "👍🏽", "👨‍👩‍👧‍👦", "❤️", "🇯🇵"])("accepts %s", (emoji) => {
    expect(isSingleEmojiGraphemeCluster(emoji)).toBe(true);
  });

  it.each(["", "  ", "🍫🍬", "abc", "A", "チョコ"])("rejects %s", (value) => {
    expect(isSingleEmojiGraphemeCluster(value)).toBe(false);
  });
});

import { CHALLENGE_DISPLAY_HIDE_AT_MS } from "@/domain/challenge";

/** Live timer deliberately truncates centiseconds so 4,999ms stays 4.99. */
export function formatLiveElapsed(elapsedMs: number): string | null {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0 || elapsedMs >= CHALLENGE_DISPLAY_HIDE_AT_MS) return null;
  return (Math.floor(elapsedMs / 10) / 100).toFixed(2);
}

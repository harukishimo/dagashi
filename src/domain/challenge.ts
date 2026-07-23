import type { ChallengeResult, ExperienceStatus } from "./types";

export const CHALLENGE_SUCCESS_MIN_MS = 9_500;
export const CHALLENGE_SUCCESS_MAX_MS = 10_500;
export const CHALLENGE_TIMEOUT_MS = 60_000;
export const CHALLENGE_DISPLAY_HIDE_AT_MS = 5_000;

export type ChallengeAction = "start" | "stop" | "skip" | "interrupt";

const transitions: Record<ExperienceStatus, readonly ExperienceStatus[]> = {
  challenge_pending: ["challenge_started", "skipped"],
  challenge_started: ["completed", "interrupted"],
  completed: [],
  skipped: [],
  interrupted: [],
};

export function canTransitionChallenge(from: ExperienceStatus, to: ExperienceStatus): boolean {
  return transitions[from].includes(to);
}

export function transitionChallenge(from: ExperienceStatus, action: ChallengeAction): ExperienceStatus {
  const target: Record<ChallengeAction, ExperienceStatus> = {
    start: "challenge_started",
    stop: "completed",
    skip: "skipped",
    interrupt: "interrupted",
  };
  const next = target[action];
  if (!canTransitionChallenge(from, next)) {
    throw new Error(`Invalid challenge transition: ${from} -> ${next}`);
  }
  return next;
}

export function isChallengeSuccess(elapsedMs: number): boolean {
  return (
    Number.isInteger(elapsedMs) &&
    elapsedMs >= CHALLENGE_SUCCESS_MIN_MS &&
    elapsedMs <= CHALLENGE_SUCCESS_MAX_MS
  );
}

export function stampCountForChallenge(elapsedMs: number | null, result: "completed" | "skipped" | "interrupted"): 1 | 2 {
  return result === "completed" && elapsedMs !== null && isChallengeSuccess(elapsedMs) ? 2 : 1;
}

export function formatChallengeElapsed(elapsedMs: number): string {
  if (!Number.isInteger(elapsedMs) || elapsedMs < 0) {
    throw new Error("elapsedMs must be a non-negative integer");
  }
  return (elapsedMs / 1_000).toFixed(2);
}

export function shouldHideLiveElapsed(elapsedMs: number): boolean {
  return elapsedMs >= CHALLENGE_DISPLAY_HIDE_AT_MS;
}

export function liveChallengeElapsed(elapsedMs: number): string | null {
  if (shouldHideLiveElapsed(elapsedMs)) return null;
  if (!Number.isInteger(elapsedMs) || elapsedMs < 0) throw new Error("elapsedMs must be a non-negative integer");
  // A live counter must never display 5.00 before the 5,000ms hide boundary.
  return (Math.floor(elapsedMs / 10) / 100).toFixed(2);
}

export function resultForElapsed(elapsedMs: number): ChallengeResult {
  const success = isChallengeSuccess(elapsedMs);
  return {
    result: success ? "success" : "try",
    elapsedMs,
    stampCount: success ? 2 : 1,
    messageKey: success ? "success" : "try",
  };
}

export function resultForSkip(): ChallengeResult {
  return { result: "skipped", elapsedMs: null, stampCount: 1, messageKey: "skip" };
}

export function resultForInterrupt(): ChallengeResult {
  return { result: "interrupted", elapsedMs: null, stampCount: 1, messageKey: "interrupted" };
}

export function resultForSaveFailure(elapsedMs: number | null): ChallengeResult {
  return { result: "fallback", elapsedMs, stampCount: 1, messageKey: "save_failed" };
}

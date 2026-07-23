"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChildHeader } from "@/components/child/ChildHeader";
import { ResultPopup, type ChallengeVisualResult } from "@/components/child/ResultPopup";
import { InlineError } from "@/components/common/InlineError";
import { CHALLENGE_TIMEOUT_MS, resultForElapsed } from "@/domain/challenge";
import { formatLiveElapsed } from "@/components/child/challenge-display";
import styles from "@/components/child/child-ui.module.css";

interface ChallengeApiResult { result: ChallengeVisualResult; elapsedMs: number | null; stampCount: 1 | 2; messageKey: string; }

export default function ChallengePage(): React.JSX.Element {
  const router = useRouter();
  const params = useParams<{ saleId: string }>();
  const saleId = decodeURIComponent(params.saleId);
  const [state, setState] = useState<"ready" | "running" | "saving" | "result" | "error">("ready");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [result, setResult] = useState<ChallengeApiResult | null>(null);
  const [error, setError] = useState("");
  const [resultSaveState, setResultSaveState] = useState<"saving" | "saved" | "error">("saved");
  const startedAt = useRef<number | null>(null);
  const stopped = useRef(false);
  const raf = useRef<number | null>(null);
  const startSave = useRef<Promise<ChallengeApiResult> | null>(null);

  const sendAction = useCallback(async (action: "start" | "stop" | "skip" | "interrupt", elapsed?: number): Promise<ChallengeApiResult> => {
    const response = await fetch(`/api/sales/${encodeURIComponent(saleId)}/challenge`, { method: "PATCH", headers: { "content-type": "application/json", Origin: window.location.origin }, credentials: "same-origin", body: JSON.stringify(elapsed === undefined ? { action } : { action, elapsedMs: elapsed }) });
    const body = (await response.json()) as { data?: ChallengeApiResult; error?: { message?: string } };
    if (!response.ok || !body.data) throw new Error(body.error?.message ?? "チャレンジの結果を保存できませんでした");
    return body.data;
  }, [saleId]);

  const finish = useCallback((elapsed: number) => {
    if (stopped.current) return;
    stopped.current = true;
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    setElapsedMs(elapsed);
    setError("");
    setResult(resultForElapsed(elapsed));
    setResultSaveState("saving");
    setState("result");

    void (async () => {
      try {
        await startSave.current;
        const saved = await sendAction("stop", elapsed);
        setResult(saved);
        setResultSaveState("saved");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "結果を保存できませんでした");
        setResultSaveState("error");
      }
    })();
  }, [sendAction]);

  useEffect(() => {
    if (state !== "running") return;
    const tick = () => {
      if (startedAt.current === null) return;
      const elapsed = Math.max(0, Math.round(performance.now() - startedAt.current));
      setElapsedMs(elapsed);
      if (elapsed >= CHALLENGE_TIMEOUT_MS) {
        void finish(CHALLENGE_TIMEOUT_MS);
        return;
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current !== null) cancelAnimationFrame(raf.current); };
  }, [state, finish]);

  useEffect(() => () => {
    if (startedAt.current !== null && !stopped.current) {
      void fetch(`/api/sales/${encodeURIComponent(saleId)}/complete`, { method: "POST", headers: { Origin: window.location.origin }, credentials: "same-origin", keepalive: true }).catch(() => undefined);
    }
  }, [saleId]);

  const start = () => {
    setError("");
    startedAt.current = performance.now();
    stopped.current = false;
    setElapsedMs(0);
    setState("running");

    const request = sendAction("start");
    startSave.current = request;
    void request.catch((cause) => {
      if (startSave.current !== request || stopped.current) return;
      stopped.current = true;
      if (raf.current !== null) cancelAnimationFrame(raf.current);
      setError(cause instanceof Error ? cause.message : "チャレンジを始められません");
      setState("error");
    });
  };

  const stop = () => {
    if (startedAt.current !== null) void finish(Math.round(performance.now() - startedAt.current));
  };

  const liveElapsed = state === "running" ? formatLiveElapsed(elapsedMs) : null;

  const skip = async () => {
    setState("saving");
    try {
      const saved = await sendAction("skip");
      setResult(saved);
      setResultSaveState("saved");
      setState("result");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "スタッフ操作を確認できません");
      setState("error");
    }
  };

  return (
    <main className={styles.page}>
      <div className={styles.pageInner}>
        <ChildHeader currentStep="challenge" />
        <section className={styles.challengePage} aria-labelledby="challenge-title">
          <div className={styles.challengePanel}>
            <h1 id="challenge-title" className={styles.title}>10秒だと おもったら ストップ！</h1>
            <p className={styles.subtitle}>数字は5秒まで見えるよ。ゆっくり数えてみよう。</p>
            {error && <InlineError>{error}</InlineError>}
            <p className={styles.challengeElapsed} aria-live="off">{liveElapsed ? `${liveElapsed}秒` : ""}</p>
            {state === "ready" && <button className={styles.challengeButton} type="button" onClick={start}>スタート</button>}
            {(state === "running" || state === "saving") && <button className={`${styles.challengeButton} ${styles.stop}`} type="button" onClick={stop} disabled={state === "saving"}>ストップ</button>}
            {state === "error" && <button className={styles.secondaryButton} type="button" onClick={() => setState("ready")}>もういちど</button>}
            {(state === "ready" || state === "error") && <button className={styles.subtleLink} type="button" onClick={() => void skip()}>スタッフ用：チャレンジをしない</button>}
          </div>
        </section>
      </div>
      {state === "result" && result && (
        <ResultPopup
          result={result.result}
          elapsedMs={result.elapsedMs}
          stampCount={result.stampCount}
          saveState={resultSaveState}
          saveError={error}
          onNext={() => {
            stopped.current = true;
            router.push(`/complete/${encodeURIComponent(saleId)}`);
          }}
        />
      )}
    </main>
  );
}

import Image from "next/image";

import styles from "./child-ui.module.css";

export type ChallengeVisualResult = "success" | "try" | "skipped" | "interrupted" | "fallback";

const CONTENT: Record<ChallengeVisualResult, { title: string; message: string; image: string }> = {
  success: { title: "すごい！10秒にぴったり！", message: "ボーナススタンプが1個ふえるよ。", image: "/challenge/challenge-success.svg" },
  try: { title: "ナイスチャレンジ！", message: "おかいものスタンプを押すよ。", image: "/challenge/challenge-try.svg" },
  skipped: { title: "おかいもの かんりょう！", message: "おかいものスタンプを押すよ。", image: "/challenge/challenge-skip.svg" },
  interrupted: { title: "おかいもの かんりょう！", message: "お店の人に画面を見せてね。", image: "/challenge/challenge-help.svg" },
  fallback: { title: "ナイスチャレンジ！", message: "お店の人に画面を見せてね。", image: "/challenge/challenge-help.svg" },
};

interface ResultPopupProps {
  result: ChallengeVisualResult;
  elapsedMs: number | null;
  stampCount: 1 | 2;
  saveState?: "saving" | "saved" | "error";
  saveError?: string;
  onNext: () => void;
}

export function ResultPopup({
  result,
  elapsedMs,
  stampCount,
  saveState = "saved",
  saveError,
  onNext,
}: ResultPopupProps): React.JSX.Element {
  const content = CONTENT[result];
  return (
    <div className={styles.resultOverlay} role="dialog" aria-modal="true" aria-labelledby="challenge-result-title">
      <section className={styles.resultPopup}>
        <Image className={styles.resultImage} src={content.image} width={240} height={200} alt="" unoptimized />
        <h2 id="challenge-result-title" className={styles.resultTitle}>{content.title}</h2>
        {elapsedMs !== null && <p className={styles.resultTime}>{(elapsedMs / 1000).toFixed(2)}<small>秒</small></p>}
        <p>{content.message}</p>
        <p className={styles.resultStamp} aria-live="polite">● スタンプ {stampCount}個</p>
        {saveState === "saving" && <p className={styles.resultSaveStatus} role="status">結果をきろくしています…</p>}
        {saveState === "error" && (
          <p className={styles.resultSaveError} role="alert">
            {saveError || "結果を保存できませんでした"}<br />お店の人をよんでね。
          </p>
        )}
        <button className={styles.primaryButton} type="button" onClick={onNext} disabled={saveState !== "saved"}>
          {saveState === "saving" ? "きろく中…" : saveState === "error" ? "保存を確認してね" : "つぎへ"}
        </button>
      </section>
    </div>
  );
}

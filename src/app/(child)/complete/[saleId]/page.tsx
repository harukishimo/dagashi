"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ChildHeader } from "@/components/child/ChildHeader";
import { clearCart } from "@/components/child/cart-storage";
import { InlineError } from "@/components/common/InlineError";
import styles from "@/components/child/child-ui.module.css";

interface Completion { saleId: string; stampCount: 1 | 2; result: string; elapsedMs: number | null; }

export default function CompletePage(): React.JSX.Element {
  const params = useParams<{ saleId: string }>();
  const saleId = decodeURIComponent(params.saleId);
  const [completion, setCompletion] = useState<Completion | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    void fetch(`/api/sales/${encodeURIComponent(saleId)}/completion`).then(async (response) => {
      const body = (await response.json()) as { data?: Completion; error?: { message?: string } };
      if (!response.ok || !body.data) throw new Error(body.error?.message ?? "完了結果を読み込めませんでした");
      setCompletion(body.data);
    }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "完了結果を読み込めませんでした"));
  }, [saleId]);
  const finish = () => { clearCart(); window.location.assign("/"); };
  return (
    <main className={styles.page}>
      <div className={styles.narrow}>
        <ChildHeader />
        <section className={styles.hero} aria-labelledby="complete-title">
          <div>
            <Image className={styles.resultImage} src="/challenge/challenge-skip.svg" width={240} height={200} alt="" unoptimized />
            <h1 id="complete-title" className={styles.heroTitle}>おかいもの かんりょう！</h1>
            {error && <InlineError>{error}<br />お店の人に画面を見せてね。</InlineError>}
            {completion && <><p className={styles.resultStamp}>● 今回のスタンプ {completion.stampCount}個</p><p className={styles.subtitle}>カードを お店の人に わたしてね。<br />15個たまったら、対象のおかし1個とこうかんできます。</p></>}
            <div className={styles.heroActions}><button className={styles.primaryButton} type="button" onClick={finish}>おわる</button></div>
            <p className={styles.staffLink}><Link href="/" className={styles.subtleLink}>はじめにもどる</Link></p>
          </div>
        </section>
      </div>
    </main>
  );
}

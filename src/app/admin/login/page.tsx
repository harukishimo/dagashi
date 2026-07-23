"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import styles from "@/components/admin/admin.module.css";

export default function AdminLoginPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [returnTo, setReturnTo] = useState("/admin");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  useEffect(() => { setReturnTo(new URLSearchParams(window.location.search).get("returnTo") || "/admin"); }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError("");
    try {
      const response = await fetch("/api/admin/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pin }) });
      const payload = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || "ログインできません");
      router.push(returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/admin");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "ログインできません"); }
    finally { setPending(false); }
  }
  return <main className={styles.login}><section className={`${styles.panel} ${styles.loginPanel}`} aria-labelledby="login-title"><h1 id="login-title">スタッフ・アドミン</h1><p>PINを入力してください。</p><form className={styles.form} onSubmit={submit}><label className={styles.label}>PIN<input className={styles.input} type="password" inputMode="numeric" autoComplete="off" minLength={4} maxLength={8} pattern="[0-9]{4,8}" value={pin} onChange={(event) => setPin(event.target.value)} /></label>{error && <p className={styles.error} role="alert">{error}</p>}<button className={styles.button} type="submit" disabled={pending}>{pending ? "確認中…" : "ログイン"}</button><Link href="/">キャンセル</Link></form></section></main>;
}

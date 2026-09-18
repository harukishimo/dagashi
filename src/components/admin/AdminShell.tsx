"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import styles from "./admin.module.css";

const navItems = [
  ["/admin", "ダッシュボード"],
  ["/admin/events", "イベント・売上"],
  ["/admin/sales/products", "商品別売上"],
  ["/admin/sales", "取引履歴"],
  ["/admin/products", "商品マスタ"],
  ["/admin/rewards/new", "特典交換"],
  ["/admin/settings", "設定・接続"],
] as const;

export function AdminShell({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const [checking, setChecking] = useState(pathname !== "/admin/login");
  useEffect(() => {
    if (pathname === "/admin/login") { setChecking(false); return; }
    let active = true;
    fetch("/api/admin/session").then(async (response) => {
      const payload = await response.json() as { authenticated?: boolean };
      if (!active) return;
      if (!response.ok || payload.authenticated !== true) {
        router.replace(`/admin/login?returnTo=${encodeURIComponent(pathname || "/admin")}`);
        return;
      }
      setChecking(false);
    }).catch(() => { if (active) router.replace(`/admin/login?returnTo=${encodeURIComponent(pathname || "/admin")}`); });
    return () => { active = false; };
  }, [pathname, router]);
  if (pathname === "/admin/login") return <>{children}</>;
  if (checking) return <main className={styles.login}><p>認証状態を確認しています…</p></main>;
  async function logout() {
    await fetch("/api/admin/session", { method: "DELETE" });
    router.push("/admin/login?returnTo=" + encodeURIComponent(pathname));
  }
  return (
    <div className={styles.shell}>
      <aside className={styles.nav} aria-label="管理メニュー">
        <h2 className={styles.navTitle}>駄菓子 管理画面</h2>
        <nav className={styles.navList}>
          {navItems.map(([href, label]) => <Link className={styles.navLink} href={href} key={href}>{label}</Link>)}
          <Link className={styles.navLink} href="/">子ども画面へ戻る</Link>
          <button className={`${styles.navLink} ${styles.button}`} type="button" onClick={logout}>ログアウト</button>
        </nav>
      </aside>
      <main className={styles.content}>{children}</main>
    </div>
  );
}

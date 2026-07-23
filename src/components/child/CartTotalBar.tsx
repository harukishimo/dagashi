import Link from "next/link";
import styles from "./child-ui.module.css";

interface CartTotalBarProps {
  itemCount: number;
  totalYen: number;
  href?: string;
}

export function CartTotalBar({ itemCount, totalYen, href = "/cart" }: CartTotalBarProps): React.JSX.Element {
  return (
    <aside className={styles.cartBar} aria-label="かごの合計">
      <div className={styles.cartBarInner}>
        <span className={styles.cartLabel}>かご {itemCount}こ</span>
        <span className={styles.cartTotal} aria-live="polite">
          {totalYen.toLocaleString("ja-JP")}<small>円</small>
        </span>
        {itemCount > 0 ? (
          <Link className={styles.primaryButton} href={href}>かごをみる</Link>
        ) : (
          <button className={styles.primaryButton} type="button" disabled>かごをみる</button>
        )}
      </div>
    </aside>
  );
}

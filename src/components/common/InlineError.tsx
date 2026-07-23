import type React from "react";
import styles from "../child/child-ui.module.css";

export function InlineError({ children, id }: { children: React.ReactNode; id?: string }): React.JSX.Element {
  return <p id={id} className={styles.errorBox} role="alert">{children}</p>;
}

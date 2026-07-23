import type React from "react";
import styles from "../child/child-ui.module.css";

interface AsyncButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  pending?: boolean;
  pendingLabel?: string;
}

export function AsyncButton({ pending = false, pendingLabel = "処理しています…", children, disabled, ...props }: AsyncButtonProps): React.JSX.Element {
  return (
    <button {...props} disabled={pending || disabled} aria-busy={pending || undefined}>
      {pending ? pendingLabel : children}
    </button>
  );
}

export { styles as childStyles };

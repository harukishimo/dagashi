import Link from "next/link";
import { Fragment } from "react";
import styles from "./child-ui.module.css";

export type ChildStep = "start" | "choose" | "cart" | "checkout" | "challenge";

const STEPS: Array<{ key: ChildStep; label: string }> = [
  { key: "choose", label: "えらぶ" },
  { key: "cart", label: "かご" },
  { key: "checkout", label: "おかいけい" },
  { key: "challenge", label: "チャレンジ" },
];

export function ChildHeader({ currentStep }: { currentStep?: ChildStep }): React.JSX.Element {
  const currentIndex = currentStep ? STEPS.findIndex((step) => step.key === currentStep) : -1;
  return (
    <header className={styles.header}>
      <Link className={styles.brand} href="/" aria-label="駄菓子おかいもの体験の開始へ">
        <span className={styles.brandMark} aria-hidden="true">🍭</span>
        <span>だがし おかいもの</span>
      </Link>
      {currentStep && (
        <nav className={styles.steps} aria-label="おかいものの進み具合">
          {STEPS.map((step, index) => (
            <Fragment key={step.key}>
              <span
                className={`${styles.step} ${index === currentIndex ? styles.stepActive : ""} ${index < currentIndex ? styles.stepDone : ""}`}
                aria-current={index === currentIndex ? "step" : undefined}
              >
                <span className={styles.stepDot}>{index < currentIndex ? "✓" : index + 1}</span>
                <span>{step.label}</span>
              </span>
              {index < STEPS.length - 1 && <span className={styles.stepLine} aria-hidden="true" />}
            </Fragment>
          ))}
        </nav>
      )}
    </header>
  );
}

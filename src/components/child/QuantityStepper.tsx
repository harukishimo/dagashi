import styles from "./child-ui.module.css";

interface QuantityStepperProps {
  productName: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (next: number) => void;
}

export function QuantityStepper({ productName, value, min = 0, max = 20, onChange }: QuantityStepperProps): React.JSX.Element {
  const decrease = () => onChange(Math.max(min, value - 1));
  const increase = () => onChange(Math.min(max, value + 1));
  return (
    <div className={styles.stepper} aria-label={`${productName}の数量`}>
      <button
        className={styles.stepperButton}
        type="button"
        aria-label={`${productName}を1個へらす`}
        onClick={decrease}
        disabled={value <= min}
      >
        −
      </button>
      <span className={styles.quantity} aria-live="polite">{value}</span>
      <button
        className={styles.stepperButton}
        type="button"
        aria-label={`${productName}を1個ふやす`}
        onClick={increase}
        disabled={value >= max}
        data-add="true"
      >
        ＋
      </button>
    </div>
  );
}

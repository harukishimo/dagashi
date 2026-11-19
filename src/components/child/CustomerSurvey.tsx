import { CUSTOMER_TYPES, CUSTOMER_TYPE_LABELS, type CustomerType } from "@/domain/customer-survey";
import styles from "./child-ui.module.css";

export function CustomerSurvey({ value, onChange, disabled = false }: { value: CustomerType; onChange: (value: CustomerType) => void; disabled?: boolean }) {
  return <fieldset className={styles.survey} disabled={disabled}>
    <legend>だれと おかいものに きたかな？（任意）</legend>
    <p>えらばなくても おかいもの できるよ。</p>
    <div className={styles.surveyOptions}>{CUSTOMER_TYPES.map(type => <label key={type} className={styles.surveyChoice}><input type="radio" name="customer-type" value={type} checked={value === type} onChange={() => onChange(type)} />{CUSTOMER_TYPE_LABELS[type]}</label>)}</div>
  </fieldset>;
}

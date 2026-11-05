import type { Setting } from "./types";
import { AppError } from "@/lib/errors";

export const OPERATION_DEFAULTS = {
  challenge_enabled: "true",
  checkout_pin_required: "true",
  shop_display_mode: "flat",
  customer_survey_enabled: "false",
} as const;
export type OperationSettingKey = keyof typeof OPERATION_DEFAULTS;
export interface OperationSettings {
  challengeEnabled: boolean;
  checkoutPinRequired: boolean;
  shopDisplayMode: "flat" | "price";
  customerSurveyEnabled: boolean;
}

export function parseOperationSettings(rows: Setting[]): OperationSettings {
  const values: Record<string, string> = { ...OPERATION_DEFAULTS };
  for (const key of Object.keys(OPERATION_DEFAULTS)) {
    const matches = rows.filter(row => row.key === key);
    if (matches.length > 1) throw new AppError("SHEETS_UNAVAILABLE");
    if (matches.length) {
      const raw = matches[0].value.trim();
      // Interpret the previous group mode as price groups after the UI update.
      const value = key === "shop_display_mode" && raw === "category" ? "price" : raw;
      const allowed = key === "shop_display_mode" ? ["flat", "price"] : ["true", "false"];
      if (!allowed.includes(value)) throw new AppError("SHEETS_UNAVAILABLE");
      values[key] = value;
    }
  }
  return { challengeEnabled: values.challenge_enabled === "true", checkoutPinRequired: values.checkout_pin_required === "true", shopDisplayMode: values.shop_display_mode as "flat" | "price", customerSurveyEnabled: values.customer_survey_enabled === "true" };
}

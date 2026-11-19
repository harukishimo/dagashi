import { z } from "zod";

export const stockUpdateSchema = z.object({
  productId: z.string().uuid(),
  stockQuantity: z.number().int().min(0).max(999999).nullable(),
  expectedStockQuantity: z.number().int().nullable(),
  expectedUpdatedAt: z.string().datetime(),
}).strict();
export const bulkStockSchema = z.object({ updates: z.array(stockUpdateSchema).min(1).max(999) }).strict().superRefine(({ updates }, ctx) => {
  if (new Set(updates.map(update => update.productId)).size !== updates.length) ctx.addIssue({ code: "custom", message: "同じ商品の重複は指定できません" });
});
export type StockUpdate = z.infer<typeof stockUpdateSchema>;

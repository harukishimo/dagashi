import { expect, test } from "@playwright/test";

test("sales show historical product details and event-scoped counted shares", async ({ page }) => {
  await page.route("**/api/admin/session", (route) => route.fulfill({ json: { authenticated: true } }));
  await page.route("**/api/admin/events", (route) => route.fulfill({ json: { data: { events: [{ eventId: "e1", name: "秋祭り" }] } } }));
  const item = { saleItemId: "i1", saleId: "s1", productId: "p1", productNameSnapshot: "チョコ（販売時）", unitPriceYen: 50, quantity: 2, lineTotalYen: 100 };
  const sale = { saleId: "s1", eventId: "e1", eventNameSnapshot: "秋祭り", soldAt: "2026-09-18T00:00:00Z", writeStatus: "completed", saleStatus: "completed", totalYen: 200, paymentMethod: "cash", items: [item, { ...item, saleItemId: "i2", productId: "p2", productNameSnapshot: "ラムネ", unitPriceYen: 100, quantity: 1, lineTotalYen: 100 }] };
  await page.route("**/api/admin/sales", (route) => route.fulfill({ json: { data: { sales: [sale,
    { ...sale, saleId: "s2", saleStatus: "voided", items: [{ ...item, saleId: "s2", saleItemId: "i3", productNameSnapshot: "取消した商品" }] },
    { ...sale, saleId: "s3", writeStatus: "pending", items: [] },
    { ...sale, saleId: "s4", eventId: null, items: [{ ...item, saleId: "s4", saleItemId: "i4" }] },
  ] } } }));
  await page.goto("/admin/sales?eventId=e1");
  const breakdown = page.getByRole("region", { name: "商品別の売上内訳" });
  await expect(breakdown.getByText("1件", { exact: true })).toBeVisible();
  await expect(breakdown.getByText("3個", { exact: true })).toBeVisible();
  await expect(breakdown.getByText("50.0%", { exact: true })).toHaveCount(2);
  await expect(breakdown.getByText("66.7%", { exact: true })).toBeVisible();
  await expect(breakdown.getByText("取消した商品")).toHaveCount(0);
  await expect(page.getByText("50円 × 2個 = 100円", { exact: true }).first()).toBeVisible();
  await page.screenshot({ path: "outputs/sales-breakdown.png", fullPage: true });
  await page.getByLabel("イベント", { exact: true }).selectOption("none");
  await expect(breakdown.getByText("100.0%", { exact: true })).toHaveCount(2);
  await expect(page.getByRole("cell", { name: "s1", exact: true })).toHaveCount(0);
});

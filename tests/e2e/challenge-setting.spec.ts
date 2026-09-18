import { expect, test } from "@playwright/test";

test("admin can turn the stopwatch off and on", async ({ page }) => {
  let enabled = "true";
  await page.route("**/api/admin/session", (route) => route.fulfill({ json: { authenticated: true } }));
  await page.route("**/api/health", (route) => route.fulfill({ json: { status: "ok" } }));
  await page.route("**/api/admin/settings", async (route) => {
    if (route.request().method() === "PATCH") enabled = String(route.request().postDataJSON().challenge_enabled);
    await route.fulfill({ json: { data: { settings: { challenge_enabled: enabled }, appVersion: "test", spreadsheetSchemaVersion: "2", spreadsheetIdConfigured: true, driveFolderConfigured: true } } });
  });
  await page.goto("/admin/settings");
  const toggle = page.getByRole("switch");
  await expect(toggle).toBeChecked();
  await toggle.click();
  await expect(page.getByRole("status")).toContainText("設定を保存しました");
  await expect(toggle).not.toBeChecked();
  expect(enabled).toBe("false");
  await toggle.click();
  await expect(toggle).toBeChecked();
  expect(enabled).toBe("true");
});

for (const replay of [false, true]) {
  test(`disabled challenge clears cart and returns home${replay ? " on recovered sale" : ""}`, async ({ page }) => {
    await page.route("**/api/products", (route) => route.fulfill({ json: { products: [] } }));
    await page.goto("/");
    await page.evaluate(() => sessionStorage.setItem("dagashi:cart:v1", JSON.stringify({ requestId: "test-request", items: [{ productId: "p", quantity: 1, product: { productId: "p", name: "チョコ", priceYen: 30, fallbackEmoji: "🍫" } }] })));
    const sale = { saleId: "saved-sale", writeStatus: "completed", experienceStatus: "skipped" };
    await page.route("**/api/sales", (route) => route.fulfill({ status: replay ? 503 : 200, json: replay ? { error: { message: "通信エラー" } } : { data: sale } }));
    await page.route("**/api/sales/by-request/test-request", (route) => route.fulfill({ json: { data: sale } }));
    await page.goto("/checkout");
    await page.getByRole("button", { name: "支払済みにする", exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    expect(await page.evaluate(() => sessionStorage.getItem("dagashi:cart:v1"))).toBeNull();
  });
}

test("unsaved sale does not clear cart or return home", async ({ page }) => {
  await page.route("**/api/products", (route) => route.fulfill({ json: { products: [] } }));
  await page.goto("/");
  await page.evaluate(() => sessionStorage.setItem("dagashi:cart:v1", JSON.stringify({ requestId: "pending-request", items: [{ productId: "p", quantity: 1, product: { productId: "p", name: "チョコ", priceYen: 30, fallbackEmoji: "🍫" } }] })));
  await page.route("**/api/sales", (route) => route.fulfill({ status: 503, json: { error: { message: "通信エラー" } } }));
  await page.route("**/api/sales/by-request/pending-request", (route) => route.fulfill({ json: { data: { saleId: "pending-sale", writeStatus: "pending", experienceStatus: "skipped" } } }));
  await page.goto("/checkout");
  await page.getByRole("button", { name: "支払済みにする", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "通信エラー" })).toBeVisible();
  await expect(page).toHaveURL(/\/checkout$/);
  expect(await page.evaluate(() => sessionStorage.getItem("dagashi:cart:v1"))).not.toBeNull();
});

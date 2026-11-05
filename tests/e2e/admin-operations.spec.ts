import { expect, test } from "@playwright/test";
const products = [
  { productId: "a", name: "チョコA", priceYen: 30, category: "チョコ", status: "active", displayOrder: 2, fallbackEmoji: "🍫", updatedAt: "2026-11-01", stockQuantity: 4 },
  { productId: "b", name: "チョコB", priceYen: 10, category: "チョコ", status: "sold_out", displayOrder: 1, fallbackEmoji: "🍫", updatedAt: "2026-11-02", stockQuantity: 0 },
  { productId: "c", name: "グミ", priceYen: 20, category: "", status: "active", displayOrder: 3, fallbackEmoji: "🍬", updatedAt: "2026-11-03", stockQuantity: 5 },
];
test.beforeEach(async ({ page }) => {
  await page.route("**/api/admin/session", route => route.fulfill({ json: { authenticated: true } }));
});

test("admin filters products by name, price and multiple statuses and changes ordering", async ({ page }) => {
  await page.route("**/api/admin/products", route => route.fulfill({ json: { products } }));
  await page.goto("/admin/products");
  const rows = page.locator("tbody tr");
  await expect(rows.first()).toContainText("チョコB");
  await page.getByRole("combobox", { name: "並び順", exact: true }).selectOption("display_order");
  await expect(rows.nth(1)).toContainText("チョコA");
  await page.getByLabel("商品名で検索").fill("ちょこ");
  const filters = page.getByRole("search", { name: "商品マスタ検索" });
  await filters.getByLabel("販売中", { exact: true }).check();
  await filters.getByLabel("売切", { exact: true }).check();
  await page.getByRole("combobox", { name: "販売価格", exact: true }).selectOption("10");
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText("チョコB");
  await filters.getByLabel("売切", { exact: true }).uncheck();
  await expect(page.getByText("条件に一致する商品はありません。検索条件を変更してください。")).toBeVisible();
  await page.getByRole("button", { name: "検索条件をリセット" }).click();
  await expect(rows).toHaveCount(3);
  await page.locator("section").last().screenshot({ path: "outputs/operations-product-filters.png" });
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("settings controls save separately below challenge and retain persisted values", async ({ page }) => {
  const settings: Record<string, string> = { challenge_enabled: "true", checkout_pin_required: "true", shop_display_mode: "flat", customer_survey_enabled: "false" };
  await page.route("**/api/health", route => route.fulfill({ json: { status: "healthy" } }));
  await page.route("**/api/admin/settings", async route => {
    if (route.request().method() === "PATCH") {
      const patch = route.request().postDataJSON();
      for (const [key, value] of Object.entries(patch)) settings[key] = String(value);
    }
    await route.fulfill({ json: { data: { settings, appVersion: "test", spreadsheetSchemaVersion: "2", spreadsheetIdConfigured: true, driveFolderConfigured: true } } });
  });
  await page.goto("/admin/settings");
  await page.getByRole("switch", { name: "取引登録前のPIN確認" }).click();
  await expect(page.getByText("設定を保存しました。子ども画面を開き直すと反映されます。")).toBeVisible();
  await page.getByRole("radio", { name: "価格別にグループ表示", exact: true }).click();
  await expect.poll(() => settings.shop_display_mode).toBe("price");
  await page.getByRole("switch", { name: "購入者属性のアンケート" }).click();
  await expect.poll(() => settings.customer_survey_enabled).toBe("true");
  await page.reload();
  await expect(page.getByRole("switch", { name: "取引登録前のPIN確認" })).not.toBeChecked();
  await expect(page.getByRole("radio", { name: "価格別にグループ表示", exact: true })).toBeChecked();
  await expect(page.getByRole("switch", { name: "購入者属性のアンケート" })).toBeChecked();
  await page.screenshot({ path: "outputs/operations-settings.png", fullPage: true });
});

test("child catalog groups by ascending price with distinct backgrounds and preserves cart in flat mode", async ({ page }) => {
  let displayMode = "price";
  const catalog = [...products, { ...products[2], productId: "d", name: "ラムネ", priceYen: 30, category: "ラムネ", displayOrder: 0 }];
  await page.setViewportSize({ width: 375, height: 812 });
  await page.route("**/api/products", route => route.fulfill({ json: { products: catalog, shopDisplayMode: displayMode } }));
  await page.goto("/shop");
  const groups = page.getByRole("region", { name: /円のおかし$/ });
  await expect(groups).toHaveCount(3);
  await expect(groups.nth(0)).toHaveAttribute("aria-label", "10円のおかし");
  await expect(groups.nth(1)).toHaveAttribute("aria-label", "20円のおかし");
  await expect(groups.nth(2)).toHaveAttribute("aria-label", "30円のおかし");
  await expect(groups.nth(2).locator("article")).toHaveCount(2);
  await expect(groups.nth(2).locator("article").first()).toContainText("ラムネ");
  const colors = await groups.evaluateAll(elements => elements.map(element => getComputedStyle(element).backgroundColor));
  expect(new Set(colors).size).toBe(3);
  await expect(page.getByRole("button", { name: "チョコBを1個ふやす" })).toBeDisabled();
  await page.getByRole("button", { name: "ラムネを1個ふやす" }).click();
  await expect(page.getByRole("complementary", { name: "かごの合計" })).toContainText("30円");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "outputs/operations-price-groups-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: "outputs/operations-price-groups.png", fullPage: true });
  displayMode = "flat";
  await page.reload();
  await expect(page.locator("article")).toHaveCount(4);
  await expect(groups).toHaveCount(0);
  await expect(page.getByRole("complementary", { name: "かごの合計" })).toContainText("30円");
});

for (const survey of [true, false]) {
  test(`checkout saves optional customer attribute, survey ${survey ? "on" : "off"}`, async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", error => pageErrors.push(error.message));
    await page.route("**/api/experience-settings", route => route.fulfill({ json: { data: { checkoutPinRequired: false, customerSurveyEnabled: survey, shopDisplayMode: "flat", challengeEnabled: false } } }));
    await page.route("**/api/products", route => route.fulfill({ json: { products: [] } }));
    await page.goto("/");
    await page.evaluate(product => sessionStorage.setItem("dagashi:cart:v1", JSON.stringify({ requestId: "sample-request", items: [{ productId: product.productId, product, quantity: 1 }] })), products[0]);
    let saved: Record<string, unknown> | null = null;
    await page.route("**/api/sales", async route => { saved = route.request().postDataJSON(); await route.fulfill({ json: { data: { saleId: "saved", writeStatus: "completed", experienceStatus: "skipped" } } }); });
    await page.goto("/checkout");
    if (survey) {
      await page.getByRole("radio", { name: "親子", exact: true }).check();
      await page.screenshot({ path: "outputs/operations-checkout-survey.png", fullPage: true });
    } else await expect(page.getByRole("radio", { name: "親子", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "支払済みにする", exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    expect(saved).toMatchObject({ customerType: survey ? "family" : "unregistered" });
    expect(pageErrors).toEqual([]);
  });
}

test("survey result follows event filter and excludes voided transactions", async ({ page }) => {
  const sale = { saleId: "1", soldAt: "2026-11-05T01:00:00Z", eventId: "event", eventNameSnapshot: "秋まつり", writeStatus: "completed", saleStatus: "completed", totalYen: 30, paymentMethod: "cash", items: [] };
  await page.route("**/api/admin/events", route => route.fulfill({ json: { data: { events: [{ eventId: "event", name: "秋まつり" }] } } }));
  await page.route("**/api/admin/sales", route => route.fulfill({ json: { data: { sales: [{ ...sale, customerType: "family" }, { ...sale, saleId: "2", eventId: null }, { ...sale, saleId: "3", customerType: "adults", saleStatus: "voided" }] } } }));
  await page.goto("/admin/sales");
  const summary = page.getByRole("region", { name: "購入者属性のアンケート結果" });
  await expect(summary.getByRole("row", { name: "親子 1件 50.0% 30円" })).toBeVisible();
  await expect(summary.getByRole("row", { name: "大人のみ 0件 0.0% 0円" })).toBeVisible();
  await page.getByLabel("イベント", { exact: true }).selectOption("event");
  await expect(summary.getByRole("row", { name: "親子 1件 100.0% 30円" })).toBeVisible();
  await page.screenshot({ path: "outputs/operations-survey-results.png", fullPage: true });
});

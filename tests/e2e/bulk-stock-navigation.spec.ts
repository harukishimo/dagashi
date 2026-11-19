import { expect, test } from "@playwright/test";

const timestamp = "2026-11-19T01:00:00.000Z";
const product = (id: string, priceYen: number, stockQuantity: number | null) => ({ productId: id, name: `おかし${id}`, priceYen, stockQuantity, status: "active", category: "駄菓子", fallbackEmoji: "🍬", displayOrder: priceYen, updatedAt: timestamp });

test("all stocks become inputs, hidden drafts save together, and cancel discards edits", async ({ page }) => {
  let products = [product("a", 10, 3), product("b", 20, 5), product("c", 30, null)];
  let saved: { updates: Array<{ productId: string; stockQuantity: number | null }> } | undefined;
  await page.route("**/api/admin/session", route => route.fulfill({ json: { authenticated: true } }));
  await page.route("**/api/admin/products", route => route.fulfill({ json: { products } }));
  await page.route("**/api/admin/products/stock", async route => {
    saved = route.request().postDataJSON();
    products = products.map(p => ({ ...p, stockQuantity: saved?.updates.find(u => u.productId === p.productId)?.stockQuantity ?? p.stockQuantity }));
    await route.fulfill({ json: { data: { updatedCount: saved?.updates.length } } });
  });
  await page.goto("/admin/products");
  await page.getByRole("button", { name: "在庫を一括編集", exact: true }).click();
  await expect(page.getByRole("spinbutton")).toHaveCount(3);
  await page.getByRole("spinbutton", { name: "おかしaの現在庫" }).fill("0");
  await page.getByRole("spinbutton", { name: "おかしbの現在庫" }).fill("12");
  await page.getByLabel("商品名で検索").fill("おかしc");
  await page.getByRole("spinbutton", { name: "おかしcの現在庫" }).fill("8");
  await page.getByRole("button", { name: "在庫を一括保存" }).click();
  await expect(page.getByText("3商品の在庫を保存しました")).toBeVisible();
  expect(saved?.updates).toEqual([
    { productId: "a", stockQuantity: 0, expectedStockQuantity: 3, expectedUpdatedAt: timestamp },
    { productId: "b", stockQuantity: 12, expectedStockQuantity: 5, expectedUpdatedAt: timestamp },
    { productId: "c", stockQuantity: 8, expectedStockQuantity: null, expectedUpdatedAt: timestamp },
  ]);
  await page.getByRole("button", { name: "在庫を一括編集", exact: true }).click();
  await page.getByRole("spinbutton", { name: "おかしaの現在庫" }).fill("99");
  await page.screenshot({ path: "outputs/bulk-stock-20261119.png", fullPage: true });
  await page.getByRole("button", { name: "キャンセル", exact: true }).click();
  await expect(page.getByText("在庫：0個")).toBeVisible();
});

test("conflicting stock save keeps drafts and allows retry after reloading", async ({ page }) => {
  await page.route("**/api/admin/session", route => route.fulfill({ json: { authenticated: true } }));
  await page.route("**/api/admin/products", route => route.fulfill({ json: { products: [product("a", 10, 3)] } }));
  await page.route("**/api/admin/products/stock", route => route.fulfill({ status: 409, json: { error: { message: "編集中に在庫が変わりました" } } }));
  await page.goto("/admin/products");
  await page.getByRole("button", { name: "在庫を一括編集", exact: true }).click();
  await page.getByRole("spinbutton", { name: "おかしaの現在庫" }).fill("9");
  await page.getByRole("button", { name: "在庫を一括保存" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "編集中に在庫が変わりました" })).toBeVisible();
  await expect(page.getByRole("spinbutton", { name: "おかしaの現在庫" })).toHaveValue("9");
  await page.getByRole("button", { name: "キャンセル", exact: true }).click();
  await expect(page.getByRole("button", { name: "最新の在庫を確認" })).toBeEnabled();
});

for (const mobile of [false, true]) {
  test(`price menu jumps and highlights the visible section (${mobile ? "mobile" : "desktop"})`, async ({ page }) => {
    await page.setViewportSize(mobile ? { width: 375, height: 812 } : { width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.route("**/api/products", route => route.fulfill({ json: { products: [product("a", 10, 3), product("b", 30, 4), product("c", 100, 6)], shopDisplayMode: "price" } }));
    await page.goto("/shop");
    const target = page.getByRole("region", { name: "100円のおかし", exact: true });
    if (mobile) await page.getByRole("button", { name: "ねだんメニュー" }).click();
    const menu = page.getByRole("navigation", { name: "価格帯へ移動" });
    await expect(menu.getByRole("link")).toHaveText(["10円", "30円", "100円"]);
    await menu.getByRole("link", { name: "100円のおかしへ移動", exact: true }).click();
    await expect.poll(async () => target.evaluate(element => Math.round(element.getBoundingClientRect().top))).toBeLessThan(190);
    if (mobile) {
      await expect(page.getByRole("dialog")).not.toBeVisible();
      await page.getByRole("button", { name: "ねだんメニュー" }).click();
    }
    await expect(menu.getByRole("link", { name: "100円のおかしへ移動", exact: true })).toHaveAttribute("aria-current", "location");
    if (mobile) await page.getByRole("button", { name: "とじる", exact: true }).click();
    await page.evaluate(() => window.scrollTo(0, 0));
    if (mobile) await page.getByRole("button", { name: "ねだんメニュー" }).click();
    await expect(menu.getByRole("link", { name: "10円のおかしへ移動", exact: true })).toHaveAttribute("aria-current", "location");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `outputs/price-navigation-${mobile ? "mobile" : "desktop"}-20261119.png`, fullPage: !mobile });
  });
}

test("shop survey persists through cart edits, checkout and purchase, then resets", async ({ page }) => {
  let surveyEnabled = true;
  await page.route("**/api/products", route => route.fulfill({ json: { products: [product("a", 10, 3)], shopDisplayMode: "price", customerSurveyEnabled: surveyEnabled } }));
  await page.route("**/api/experience-settings", route => route.fulfill({ json: { data: { customerSurveyEnabled: surveyEnabled, checkoutPinRequired: false } } }));
  let saved: { customerType?: string } | undefined;
  await page.route("**/api/sales", async route => { saved = route.request().postDataJSON(); await route.fulfill({ json: { data: { saleId: "saved", writeStatus: "completed", experienceStatus: "skipped" } } }); });
  await page.goto("/shop");
  await page.getByRole("radio", { name: "親子", exact: true }).check();
  await page.getByRole("button", { name: "おかしaの画像から1個ふやす" }).click();
  await page.reload();
  await expect(page.getByRole("radio", { name: "親子", exact: true })).toBeChecked();
  await page.goto("/cart");
  await page.getByRole("button", { name: "おかしaを1個ふやす", exact: true }).click();
  await page.goto("/checkout");
  await expect(page.getByRole("radio", { name: "親子", exact: true })).toBeChecked();
  await page.getByRole("radio", { name: "大人のみ", exact: true }).check();
  await page.goto("/shop");
  await expect(page.getByRole("radio", { name: "大人のみ", exact: true })).toBeChecked();
  await page.goto("/checkout");
  await page.getByRole("button", { name: "支払済みにする", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(saved?.customerType).toBe("adults");
  await page.goto("/shop");
  await expect(page.getByRole("radio", { name: "未登録", exact: true })).toBeChecked();
  surveyEnabled = false;
  await page.reload();
  await expect(page.getByRole("radio", { name: "親子", exact: true })).toHaveCount(0);
});

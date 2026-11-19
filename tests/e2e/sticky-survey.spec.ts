import { expect, test } from "@playwright/test";

const products = Array.from({ length: 6 }, (_, index) => ({
  productId: `product-${index}`, name: `おかし${index}`, priceYen: (index + 1) * 10,
  stockQuantity: 20, status: "active", category: "駄菓子", fallbackEmoji: "🍬", displayOrder: index,
}));

for (const variant of [
  { name: "desktop price", width: 1440, height: 900, mode: "price" },
  { name: "phone price", width: 375, height: 812, mode: "price" },
  { name: "landscape price", width: 844, height: 390, mode: "price" },
  { name: "desktop flat", width: 1440, height: 900, mode: "flat" },
  { name: "phone flat", width: 375, height: 812, mode: "flat" },
]) {
  test(`survey stays selectable at the last product without returning to the top (${variant.name})`, async ({ page }) => {
    await page.setViewportSize({ width: variant.width, height: variant.height });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.route("**/api/products", route => route.fulfill({ json: { products, shopDisplayMode: variant.mode, customerSurveyEnabled: true } }));
    await page.route("**/api/experience-settings", route => route.fulfill({ json: { data: { customerSurveyEnabled: true, checkoutPinRequired: false } } }));
    await page.goto("/shop");
    const survey = page.getByRole("group", { name: "だれと おかいもの？（任意）", exact: true });
    await expect(survey).toBeVisible();
    if (variant.mode === "price") {
      if (variant.width <= 1000) await page.getByRole("button", { name: "ねだんメニュー" }).click();
      const link = page.getByRole("link", { name: "60円のおかしへ移動", exact: true });
      await link.click();
      if (variant.width > 1000) await expect(link).toHaveAttribute("aria-current", "location");
      await expect.poll(async () => {
        const group = await page.getByRole("region", { name: "60円のおかし", exact: true }).boundingBox();
        const bar = await survey.boundingBox();
        return group && bar ? group.y - (bar.y + bar.height) : -1;
      }).toBeGreaterThanOrEqual(12);
    } else {
      await page.getByRole("button", { name: "おかし5の画像から1個ふやす", exact: true }).evaluate(element => element.scrollIntoView({ block: "center" }));
    }
    await expect.poll(async () => page.evaluate(() => scrollY)).toBeGreaterThan(300);
    const bar = await survey.boundingBox();
    const footer = await page.getByRole("complementary", { name: "かごの合計" }).boundingBox();
    expect(bar).not.toBeNull();
    expect(footer).not.toBeNull();
    expect(bar!.y).toBeGreaterThanOrEqual(0);
    expect(bar!.y + bar!.height).toBeLessThan(footer!.y);
    if (variant.mode === "price" && variant.width <= 1000) {
      const toggle = await page.getByRole("button", { name: "ねだんメニュー" }).boundingBox();
      expect(bar!.y).toBeGreaterThanOrEqual(toggle!.y + toggle!.height + 8);
    }
    const scrollBefore = await page.evaluate(() => scrollY);
    for (const name of ["親子", "子どものみ", "大人のみ", "未登録"]) {
      await survey.getByRole("radio", { name, exact: true }).check();
      await expect(survey.getByRole("radio", { name, exact: true })).toBeChecked();
    }
    await survey.getByRole("radio", { name: "親子", exact: true }).check();
    expect(Math.abs((await page.evaluate(() => scrollY)) - scrollBefore)).toBeLessThan(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `outputs/sticky-survey-${variant.name.replaceAll(" ", "-")}.png` });
    await page.getByRole("button", { name: "おかし5の画像から1個ふやす", exact: true }).click();
    await page.goto("/checkout");
    await expect(page.getByRole("radio", { name: "親子", exact: true })).toBeChecked();
  });
}

test("disabled survey does not reserve a sticky toolbar", async ({ page }) => {
  await page.route("**/api/products", route => route.fulfill({ json: { products, shopDisplayMode: "price", customerSurveyEnabled: false } }));
  await page.goto("/shop");
  await expect(page.getByRole("region", { name: "10円のおかし", exact: true })).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(0);
});

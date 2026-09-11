import { expect, test } from "@playwright/test";

test("sold-out products stay visible and cannot be added", async ({ page }) => {
  await page.route("**/api/products", (route) => route.fulfill({ json: { products: [
    { productId: "p", name: "売切チョコ", priceYen: 30, fallbackEmoji: "🍫", status: "active", stockQuantity: 0 },
  ] } }));
  await page.goto("/shop");
  await expect(page.getByText("売り切れ", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "売切チョコを1個ふやす" })).toBeDisabled();
  await expect(page.locator("article")).toHaveCSS("filter", "grayscale(1)");
});

test("application shell responds", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "じぶんで えらんでみよう！" })).toBeVisible();
});

test("admin can inspect and change stock", async ({ page }) => {
  let stock = 2;
  await page.route("**/api/admin/session", (route) => route.fulfill({ json: { authenticated: true } }));
  const product = () => ({ productId: "p", name: "在庫チョコ", priceYen: 30, category: "チョコ", fallbackEmoji: "🍫", status: "active", displayOrder: 1, stockQuantity: stock });
  await page.route("**/api/admin/products", (route) => route.fulfill({ json: { products: [product()] } }));
  await page.route("**/api/admin/products/p", async (route) => {
    stock = route.request().postDataJSON().stockQuantity;
    await route.fulfill({ json: { product: product() } });
  });
  await page.goto("/admin/products");
  await expect(page.getByText("在庫：2個")).toBeVisible();
  await page.getByRole("button", { name: "編集", exact: true }).click();
  await page.getByLabel("現在庫（個・空欄は在庫管理なし）").fill("0");
  await page.getByRole("button", { name: "変更を保存" }).click();
  await expect(page.getByText("在庫：0個")).toBeVisible();
});

test("child flow shows product emoji fallback when Drive image is unavailable", async ({ page }) => {
  await page.route("**/api/products", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        products: [{
          productId: "11111111-1111-4111-8111-111111111111",
          name: "[テスト] チョコスナック",
          priceYen: 30,
          category: "チョコ",
          fallbackEmoji: "🍫",
          imageUrl: null,
          imageUpdatedAt: null,
          displayOrder: 10,
        }],
      }),
    });
  });
  await page.goto("/");
  await page.getByRole("link", { name: "おかいものを はじめる" }).click();
  await expect(page.getByRole("heading", { name: "ほしいおかしを えらんでね" })).toBeVisible();
  await expect(page.getByRole("img", { name: "[テスト] チョコスナック" })).toHaveText("🍫");
  await expect(page.getByRole("button", { name: "[テスト] チョコスナックを1個ふやす" })).toBeVisible();
});

test("child can add one item and see the live cart total", async ({ page }) => {
  await page.route("**/api/products", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ products: [{ productId: "11111111-1111-4111-8111-111111111111", name: "[テスト] チョコスナック", priceYen: 30, category: "チョコ", fallbackEmoji: "🍫", imageUrl: null, imageUpdatedAt: null, displayOrder: 10 }] }),
    });
  });
  await page.goto("/");
  await page.getByRole("link", { name: "おかいものを はじめる" }).click();
  await page.getByRole("button", { name: "[テスト] チョコスナックを1個ふやす" }).click();
  await expect(page.getByRole("complementary", { name: "かごの合計" })).toContainText("かご 1こ");
  await expect(page.getByRole("complementary", { name: "かごの合計" })).toContainText("30円");
});

test("challenge result is a positive dialog with the awarded stamp count", async ({ page }) => {
  const saleId = "11111111-1111-4111-8111-111111111111";
  await page.route(`**/api/sales/${saleId}/challenge`, async (route) => {
    const body = JSON.parse(route.request().postData() ?? "{}");
    if (body.action === "start") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { result: "try", elapsedMs: null, stampCount: 1, messageKey: "try" } }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { result: "success", elapsedMs: 10000, stampCount: 2, messageKey: "success" } }) });
  });
  await page.route(`**/api/sales/${saleId}/complete`, async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { result: "interrupted" } }) });
  });
  await page.goto(`/challenge/${saleId}`);
  await page.getByRole("button", { name: "スタート" }).click();
  await page.getByRole("button", { name: "ストップ" }).click();
  const dialog = page.getByRole("dialog", { name: "すごい！10秒にぴったり！" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("スタンプ 2個");
  await expect(dialog).toContainText("ボーナススタンプが1個ふえるよ。");
  await expect(dialog.locator("img")).toHaveAttribute("src", "/challenge/challenge-success.svg");
});

test("challenge controls respond before result persistence completes", async ({ page }) => {
  const saleId = "22222222-2222-4222-8222-222222222222";
  let releaseStart!: () => void;
  let releaseStop!: () => void;
  const startGate = new Promise<void>((resolve) => { releaseStart = resolve; });
  const stopGate = new Promise<void>((resolve) => { releaseStop = resolve; });

  await page.route(`**/api/sales/${saleId}/challenge`, async (route) => {
    const body = JSON.parse(route.request().postData() ?? "{}");
    if (body.action === "start") {
      await startGate;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { result: "try", elapsedMs: null, stampCount: 1, messageKey: "try" } }) });
      return;
    }
    await stopGate;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { result: "try", elapsedMs: body.elapsedMs, stampCount: 1, messageKey: "try" } }) });
  });

  await page.goto(`/challenge/${saleId}`);
  await page.getByRole("button", { name: "スタート" }).click();
  await expect(page.getByRole("button", { name: "ストップ" })).toBeVisible();
  await page.getByRole("button", { name: "ストップ" }).click();

  const dialog = page.getByRole("dialog", { name: "ナイスチャレンジ！" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("結果をきろくしています…");
  await expect(dialog.getByRole("button", { name: "きろく中…" })).toBeDisabled();

  releaseStart();
  releaseStop();
  await expect(dialog.getByRole("button", { name: "つぎへ" })).toBeEnabled();
});

test("admin pages redirect unauthenticated users to the login screen", async ({ page }) => {
  await page.route("**/api/admin/session", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ authenticated: false, expiresAt: null }) });
  });
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login\?returnTo=%2Fadmin$/);
  await expect(page.getByRole("heading", { name: "スタッフ・アドミン" })).toBeVisible();
});

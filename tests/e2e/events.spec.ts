import { expect, test } from "@playwright/test";

test("admin creates event, inspects its sales and stops future attribution", async ({ page }) => {
  let events: Array<Record<string, unknown>> = [];
  await page.route("**/api/admin/session", (route) => route.fulfill({ json: { authenticated: true } }));
  await page.route("**/api/admin/events", async (route) => {
    if (route.request().method() === "POST") {
      events = [{ ...route.request().postDataJSON(), eventId: "e1", saleCount: 2, totalYen: 500, status: "active" }];
      await route.fulfill({ status: 201, json: { data: { event: events[0] } } });
    } else await route.fulfill({ json: { data: { events } } });
  });
  await page.route("**/api/admin/events/e1", async (route) => {
    events[0].status = "archived";
    await route.fulfill({ json: { data: { archived: true } } });
  });
  await page.route("**/api/admin/sales", (route) => route.fulfill({ json: { data: { sales: [
    { saleId: "s1", eventId: "e1", eventNameSnapshot: "秋祭り", soldAt: "2026-09-18T00:00:00Z", writeStatus: "completed", saleStatus: "completed", totalYen: 500, paymentMethod: "cash", items: [] },
    { saleId: "s2", eventId: null, soldAt: "2026-09-18T00:00:00Z", writeStatus: "completed", saleStatus: "completed", totalYen: 100, paymentMethod: "cash", items: [] },
  ] } } }));
  await page.goto("/admin/events");
  await page.getByLabel("イベント名").fill("秋祭り");
  await page.getByLabel("開始日").fill("2026-09-18");
  await page.getByLabel("終了日").fill("2026-09-19");
  await page.getByRole("button", { name: "イベントを登録" }).click();
  await expect(page.getByText("500円", { exact: true })).toBeVisible();
  await page.screenshot({ path: "outputs/events-admin.png", fullPage: true });
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "秋祭りを停止" }).click();
  await expect(page.getByText("停止済み", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "取引を見る", exact: true }).click();
  await expect(page.getByRole("cell", { name: "s1", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "s2", exact: true })).toHaveCount(0);
  await page.getByLabel("イベント", { exact: true }).selectOption("none");
  await expect(page.getByRole("cell", { name: "s2", exact: true })).toBeVisible();
});

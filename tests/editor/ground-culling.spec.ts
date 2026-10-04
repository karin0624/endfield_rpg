import type { Page } from "@playwright/test";
import { collectCoverage, expect, test } from "../e2e/coverage";

async function show(page: Page, view = "default") {
  // This helper also navigates between views within one test.
  await collectCoverage(page);
  await page.goto(`/tests/fixtures/battle-lifecycle.html?view=${view}`);
  await page.locator("#full").click();
  await expect(page.getByLabel("表示状態")).toHaveText("4人の表示完了", { timeout: 60_000 });
}

async function expectGround(page: Page, name: string) {
  await expect(page.locator("canvas")).toHaveScreenshot(name, {
    threshold: 0,
    maxDiffPixels: 0,
    stylePath: "tests/fixtures/ground-culling-screenshot.css",
  });
}

for (const view of ["left-down", "left-up", "right-down", "right-up"]) {
  test(`検証範囲の${view}でも地形と人物を保持する`, async ({ page }) => {
    await show(page, view);
    await expectGround(page, `ground-${view}.png`);
  });
}

test("地形内部の適用と未検証構図のプレビューは元材質を保ち、既定構図へ戻せる", async ({ page }) => {
  await show(page);
  await page.getByLabel("検証構図").selectOption("internal");
  await page.locator("#apply-view").click();
  await expectGround(page, "ground-internal-original.png");
  await page.getByLabel("検証構図").selectOption("edited");
  await page.locator("#preview-view").click();
  await expectGround(page, "ground-edited-original.png");
  await page.getByLabel("検証構図").selectOption("default");
  await page.locator("#apply-view").click();
  await expectGround(page, "ground-default-pc.png");
});

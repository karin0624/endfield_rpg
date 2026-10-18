import { collectCoverage, expect, test } from "../browser/coverage";
import { readyPicture } from "./appearance";

test("通常配布のentryが初期タイトルを起動し、スクリプトと素材の取得に失敗しない", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.url().includes("/assets/") && response.status() >= 400)
      errors.push(`${response.status()} ${response.url()}`);
  });
  await page.goto("http://127.0.0.1:4173/");
  await readyPicture(page);
  await expect(page.getByRole("heading", { name: "ENDFIELD RPG", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "新規開始", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "続きから", exact: true })).toBeEnabled();
  expect(errors).toEqual([]);
});

test("直接状態の画面幅切替でメニューと地図closeのkeyboard focusを保持する", async ({ page }) => {
  for (const [state, label] of [
    ["home", "メニュー"],
    ["town", "メニュー"],
    ["destinations", "地図を閉じる"],
  ] as const) {
    await collectCoverage(page);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(`http://127.0.0.1:4174/rpg/tests/fixtures/campaign-view.html?state=${state}`);
    await readyPicture(page);
    const opener = page.getByRole("button", { name: label, exact: true });
    await opener.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(opener).toBeFocused();
    await page.setViewportSize({ width: 800, height: 900 });
    await expect(page.locator(".hub-scene")).toHaveAttribute("data-mode", "compact");
    await expect(opener).toBeFocused();
    await expect(opener).toHaveCSS("outline-style", "solid");
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page.locator(".hub-scene")).toHaveAttribute("data-mode", "wide");
    await expect(opener).toBeFocused();
    await expect(opener).toHaveCSS("outline-style", "solid");
  }
});

test("390pxの場所一覧は文字拡大で2列が入らなければ1列へ折り返す", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  for (const state of ["destinations", "town"]) {
    await collectCoverage(page);
    await page.goto(`http://127.0.0.1:4174/rpg/tests/fixtures/campaign-view.html?state=${state}`);
    await readyPicture(page);
    const cards = page.locator(".locations button");
    await expect(page.locator(".hub-scene")).toHaveAttribute("data-mode", "compact");
    const first = await cards.nth(0).boundingBox();
    const second = await cards.nth(1).boundingBox();
    expect(first?.y).toBe(second?.y);
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "20px";
    });
    await expect
      .poll(async () => {
        const a = await cards.nth(0).boundingBox();
        const b = await cards.nth(1).boundingBox();
        return a && b ? b.y >= a.y + a.height : false;
      })
      .toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
    for (const card of await cards.all()) {
      await card.focus();
      await expect(card).toBeFocused();
      await expect(card).toBeInViewport();
      const rect = await card.boundingBox();
      expect(rect).not.toBeNull();
      expect(rect?.x).toBeGreaterThanOrEqual(0);
      expect((rect?.x ?? 0) + (rect?.width ?? 0)).toBeLessThanOrEqual(390);
    }
  }
});

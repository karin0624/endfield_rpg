import { approvedPicture } from "../browser/pictures";

const golden = (name: string) =>
  approvedPicture(["long", "campaign.spec.ts-snapshots", name.replace(/\.png$/, `-built-${process.platform}.png`)]);

import { collectCoverage, expect, test } from "../browser/coverage";
import { pointerFocusAppearance, readyPicture } from "./appearance";

test("通常配布の初期タイトルと9つの直接状態を既存画像へ比較する", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.url().includes("/assets/") && response.status() >= 400)
      errors.push(`${response.status()} ${response.url()}`);
  });
  for (const [state, name] of [
    ["title", "01-title"],
    ["confirmation", "02-new-game-confirmation"],
    ["introduction", "03-introduction"],
    ["home", "04-home"],
    ["destinations", "05-destinations"],
    ["town", "06-town"],
    ["returned", "07-returned-home"],
    ["save", "08-save-confirmation"],
    ["saved", "09-saved-title"],
    ["resumed", "10-resumed-home"],
  ] as const) {
    await collectCoverage(page);
    await page.goto(
      state === "title"
        ? "http://127.0.0.1:4173/"
        : `http://127.0.0.1:4174/rpg/tests/fixtures/campaign-view.html?state=${state}`,
    );
    await readyPicture(page);
    if (state !== "title") await pointerFocusAppearance(page);
    await page.mouse.move(0, 0);
    await expect.soft(page).toHaveScreenshot(golden(`campaign-${name}-1920.png`));
  }
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

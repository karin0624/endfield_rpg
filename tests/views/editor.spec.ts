import { collectCoverage, expect, test } from "../e2e/coverage";
import { pointerFocusAppearance, readyPicture } from "./appearance";

test("設定済みの構図と人数を直接描き、既存の3画像へ比較する", async ({ page }) => {
  await page.goto("http://127.0.0.1:4174/rpg/tests/fixtures/editor-view.html");
  await expect(page.locator("#app")).toHaveAttribute("data-picture-ready", "true", { timeout: 60_000 });
  await readyPicture(page);
  await pointerFocusAppearance(page);
  await expect.soft(page.locator("canvas")).toHaveScreenshot("edited-battle-scene.png");
  await page.evaluate(() =>
    (window as typeof window & { paintEditorPicture(count: 1 | 2): void }).paintEditorPicture(1),
  );
  await expect.soft(page.locator("canvas")).toHaveScreenshot("one-on-one-scene.png");
  await page.evaluate(() =>
    (window as typeof window & { paintEditorPicture(count: 1 | 2): void }).paintEditorPicture(2),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.soft(page).toHaveScreenshot("editor-mobile.png", { fullPage: true });
});

test("会話設定の編集・保存済み表示を直接描き、既存の2画像へ比較する", async ({ page }) => {
  for (const [saved, name] of [
    [false, "adventure-edited-preview.png"],
    [true, "adventure-saved-dialogue.png"],
  ] as const) {
    await collectCoverage(page);
    await page.goto(`http://127.0.0.1:4174/rpg/tests/fixtures/editor-view.html?adventure=1${saved ? "&saved=1" : ""}`);
    await readyPicture(page);
    await pointerFocusAppearance(page);
    await expect.soft(page.locator("[data-adventure-screen]")).toHaveScreenshot(name);
  }
});

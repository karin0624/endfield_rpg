import { expect, test } from "../e2e/coverage";
import { readyPicture } from "./appearance";

test("通常minifyの実debug入口から初期戦闘を直接描き、既存PC/mobile画像へ比較する", async ({ page }) => {
  await page.goto("http://127.0.0.1:4175/?debug=1&battle=1");
  await expect(page.locator("canvas")).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
  await readyPicture(page);
  await expect.soft(page).toHaveScreenshot("battle-desktop.png", { animations: "disabled" });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.soft(page).toHaveScreenshot("battle-mobile.png", { animations: "disabled", fullPage: true });
});

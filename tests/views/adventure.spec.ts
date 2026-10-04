import { collectCoverage, expect, test } from "../e2e/coverage";
import { readyPicture } from "./appearance";

test("話者と選択肢を直接描き、既存390px画像へ比較する", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [choice, name] of [
    [false, "gilberta"],
    [true, "choice"],
  ] as const) {
    await collectCoverage(page);
    await page.goto(`http://127.0.0.1:4174/rpg/tests/fixtures/adventure-view.html${choice ? "?choice=1" : ""}`);
    await readyPicture(page);
    if (choice) await page.getByRole("button", { name: /今日は何も聞かない/ }).hover();
    await expect.soft(page.locator("[data-adventure-screen]")).toHaveScreenshot(`conversation-${name}-390.png`);
  }
});

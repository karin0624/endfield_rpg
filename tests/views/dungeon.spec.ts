import { collectCoverage, test } from "../browser/coverage";
import { readyPicture } from "./appearance";

test("通常探索の直接状態で回復品ボタンがルート面の上からポインターを受ける", async ({ page }) => {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await collectCoverage(page);
    await page.goto("http://127.0.0.1:4174/rpg/tests/fixtures/dungeon-view.html");
    await readyPicture(page);
    // Native hit testing only: no click is dispatched and no game input is applied.
    await page.getByRole("button", { name: "物品（HP回復品 ×2）" }).click({ trial: true, timeout: 2000 });
  }
});

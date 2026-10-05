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
    await expect.soft(page).toHaveScreenshot(golden(`campaign-${name}-1920.png`));
  }
  expect(errors).toEqual([]);
});

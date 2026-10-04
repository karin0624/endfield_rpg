import { approvedPicture } from "../browser/pictures";

const golden = (name: string) =>
  approvedPicture(["e2e", "ui", "battle-ui.spec.ts-snapshots", name.replace(/\.png$/, `-ui-${process.platform}.png`)]);

import { expect, test } from "../browser/coverage";
import { readyPicture } from "./appearance";

for (const [effect, pictures] of [
  ["attack", ["actor", "impact", "result", "defeat"]],
  ["heal", ["heal-impact", "heal-result"]],
] as const) {
  test(`実素材の${effect}を直接表示時刻から描き、既存FX画像へ比較する`, async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 1000 });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto(`http://127.0.0.1:4174/rpg/tests/fixtures/battle-view.html${effect === "heal" ? "?heal=1" : ""}`);
    await expect(page.locator("#app")).toHaveAttribute("data-picture-ready", "true", { timeout: 60_000 });
    await readyPicture(page);
    // Match the original frozen FX pictures without changing production CSS.
    await page.addStyleTag({ content: ".hp-track > span, .enemy-world-track > span { transition: none !important; }" });
    for (const picture of pictures) {
      await page.evaluate(async (name) => {
        await (window as typeof window & { paintBattlePicture(name: string): Promise<void> }).paintBattlePicture(name);
      }, picture);
      const clip = await page.locator(".stage").boundingBox();
      if (!clip || !Object.values(clip).every(Number.isFinite) || clip.width <= 0 || clip.height <= 0)
        throw new Error("The FX stage needs a finite visible rectangle");
      const x = Math.floor(clip.x + 0.001),
        y = Math.floor(clip.y + 0.001);
      await expect.soft(page).toHaveScreenshot(golden(`battle-fx-${picture}.png`), {
        clip: {
          x,
          y,
          width: Math.ceil(clip.x + clip.width - 0.001) - x,
          height: Math.ceil(clip.y + clip.height - 0.001) - y,
        },
        animations: "allow",
        maxDiffPixels: 0,
      });
    }
  });
}

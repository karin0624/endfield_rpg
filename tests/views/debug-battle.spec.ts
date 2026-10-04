import { approvedPicture } from "../browser/pictures";

const golden = (name: string) =>
  approvedPicture([
    "e2e",
    "debug",
    "battle.spec.ts-snapshots",
    name.replace(/\.png$/, `-built-${process.platform}.png`),
  ]);

import { expect, test } from "../browser/coverage";
import { observeWebGLResources, webGLResources } from "../browser/webglResources";
import { readyPicture } from "./appearance";

test("通常minifyの実debug入口から初期戦闘を直接描き、既存PC/mobile画像へ比較する", async ({ page }) => {
  await observeWebGLResources(page);
  await page.goto("http://127.0.0.1:4175/?debug=1&battle=1");
  await expect(page.locator("canvas")).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
  await readyPicture(page);
  await expect.soft(page).toHaveScreenshot(golden("battle-desktop.png"), { animations: "disabled" });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.soft(page).toHaveScreenshot(golden("battle-mobile.png"), { animations: "disabled", fullPage: true });
  const warm = await webGLResources(page);
  for (const kind of ["Buffer", "Texture", "Program"]) expect(warm[kind]).toBeGreaterThan(0);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true })));
  expect(await webGLResources(page)).toEqual(warm);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: false })));
  await expect.poll(() => webGLResources(page)).toEqual({ Buffer: 0, Texture: 0, Program: 0 });
});

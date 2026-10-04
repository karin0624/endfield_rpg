import type { Page } from "@playwright/test";
import { expect } from "../browser/coverage";
import { approvedPicture } from "../browser/pictures";
import type { GroundView } from "../fixtures/ground-view";

export const rendererPictureEntry = "http://127.0.0.1:4174/rpg/tests/fixtures/ground-view.html";

/** Each initial picture owns a fresh renderer, even when the document and HTTP cache are shared. */
export async function createGroundPicture(page: Page, view = "default") {
  await page.evaluate(async (view) => {
    const native = (window as typeof window & { groundView: GroundView }).groundView;
    native.create(view);
    native.start();
    await native.ready();
  }, view);
}

export async function expectGroundPicture(page: Page, name: string, group = "ground-culling") {
  await expect
    .soft(page.locator("canvas"))
    .toHaveScreenshot(
      approvedPicture(["e2e", "settings", `${group}.spec.ts-snapshots`, `${name}-settings-${process.platform}.png`]),
      {
        threshold: 0,
        maxDiffPixels: 0,
        stylePath: "tests/fixtures/ground-culling-screenshot.css",
      },
    );
}

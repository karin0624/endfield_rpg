import { test } from "../../browser/coverage";
import type { GroundView } from "../../fixtures/ground-view";
import { createGroundPicture, expectGroundPicture, rendererPictureEntry } from "../../views/groundPictures";

test("任意の四隅の初期設定をそれぞれ実rendererへ渡し、既存構図を直接比較する", async ({ page }) => {
  await page.goto(rendererPictureEntry);
  for (const view of ["left-down", "left-up", "right-down", "right-up"]) {
    await createGroundPicture(page, view);
    await expectGroundPicture(page, `ground-${view}`);
  }
});

test("内部構図と未検証previewの元材質、既定へ戻す実更新を直接比較する", async ({ page }) => {
  await page.goto(rendererPictureEntry);
  await createGroundPicture(page);
  for (const [view, preview, picture] of [
    ["internal", false, "ground-internal-original"],
    ["edited", true, "ground-edited-original"],
    ["default", false, "ground-default-pc"],
  ] as const) {
    await page.evaluate(
      ([view, preview]) => (window as typeof window & { groundView: GroundView }).groundView.apply(view, preview),
      [view, preview] as const,
    );
    await expectGroundPicture(page, picture);
  }
});

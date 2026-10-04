import { test } from "../../browser/coverage";
import type { GroundView } from "../../fixtures/ground-view";
import { createGroundPicture, expectGroundPicture, rendererPictureEntry } from "../../views/groundPictures";

test("5個の単独設定のfresh constructorと各default更新を実素材の6画像へ直接比較する", async ({ page }) => {
  await page.goto(rendererPictureEntry);
  for (const view of ["only-ground-scale", "only-formation-x", "only-formation-z", "only-backdrop", "only-camera"]) {
    await createGroundPicture(page, view);
    await expectGroundPicture(page, `independent-${view}`, "renderer");
    await page.evaluate(async () => {
      const native = (window as typeof window & { groundView: GroundView }).groundView;
      await native.apply("default");
      // The next scene must inherit the same renderer's updated settings, as in the original pictures.
      native.start();
      await native.ready();
    });
    await expectGroundPicture(page, "independent-default", "renderer");
  }
});

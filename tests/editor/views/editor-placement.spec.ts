import { test } from "../../browser/coverage";
import type { GroundView } from "../../fixtures/ground-view";
import { createGroundPicture, expectGroundPicture, rendererPictureEntry } from "../../views/groundPictures";

for (const view of ["only-ground-scale", "only-formation-x", "only-formation-z", "only-backdrop", "only-camera"]) {
  test(`${view}のfresh constructorとdefaultを次sceneへ引き継ぐ実素材画像を直接比較する`, async ({ page }) => {
    await page.goto(rendererPictureEntry);
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
  });
}

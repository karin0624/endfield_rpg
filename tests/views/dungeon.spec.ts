import { collectCoverage, expect, test } from "../e2e/coverage";
import { readyPicture } from "./appearance";

test("初期と会話解決後のルートを直接描き、既存2画像へ比較する", async ({ page }, testInfo) => {
  for (const [width, progressed, name] of [
    [390, false, "route-initial-390.png"],
    [1440, true, "route-progressed-1440.png"],
  ] as const) {
    await page.setViewportSize({ width, height: 844 });
    await collectCoverage(page);
    await page.goto(`http://127.0.0.1:4174/rpg/tests/fixtures/dungeon-view.html${progressed ? "?progressed=1" : ""}`);
    await readyPicture(page);
    await page.mouse.move(0, 0);
    await testInfo.attach(`${name}-layout`, {
      contentType: "application/json",
      body: JSON.stringify(
        await page.evaluate(() => {
          const world = document.querySelector<HTMLElement>("[data-route-world]");
          if (!world) throw new Error("Missing route layout");
          return {
            world: { width: world.clientWidth, height: world.clientHeight },
            nodes: Array.from(world.querySelectorAll<HTMLButtonElement>("button"), (button) => {
              const image = button.querySelector("img");
              if (!image) throw new Error("Missing node image");
              return {
                id: button.dataset.nodeId,
                centerX: button.offsetLeft,
                centerY: button.offsetTop,
                buttonWidth: button.offsetWidth,
                buttonHeight: button.offsetHeight,
                imageLeft: image.offsetLeft,
                imageTop: image.offsetTop,
                imageWidth: image.offsetWidth,
                imageHeight: image.offsetHeight,
              };
            }),
          };
        }),
      ),
    });
    await expect.soft(page).toHaveScreenshot(name);
  }
});

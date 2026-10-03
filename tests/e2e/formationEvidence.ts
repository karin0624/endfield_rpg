import { writeFile } from "node:fs/promises";
import { expect, type Page, type TestInfo } from "@playwright/test";

/** Dynamic portraits are created after navigation; page load alone cannot prove they were painted. */
export async function readyFormation(page: Page) {
  const ready = await page.evaluate(async () => {
    await document.fonts.ready;
    const images = Array.from(
      document.querySelectorAll<HTMLImageElement>(".formation-screen img, .character-details img"),
    ).filter((image) => image.getClientRects().length > 0);
    await Promise.all(images.map((image) => image.decode()));
    return {
      fonts: Array.from(document.fonts)
        .filter((font) => font.family.startsWith("Endfield UI"))
        .map((font) => ({ family: font.family, status: font.status })),
      images: images.map((image) => ({
        src: image.currentSrc,
        width: image.naturalWidth,
        height: image.naturalHeight,
      })),
    };
  });
  expect(ready.fonts).toEqual(
    expect.arrayContaining([
      { family: "Endfield UI Serif", status: "loaded" },
      { family: "Endfield UI Sans", status: "loaded" },
    ]),
  );
  for (const image of ready.images) {
    expect(image.width, image.src).toBeGreaterThan(0);
    expect(image.height, image.src).toBeGreaterThan(0);
  }
  return ready;
}

export async function formationScreenshot(page: Page, info: TestInfo, filename: string) {
  const readiness = await readyFormation(page);
  const session = await page.context().newCDPSession(page);
  await session.send("DOM.enable");
  await session.send("CSS.enable");
  const { root } = await session.send("DOM.getDocument");
  const { nodeId } = await session.send("DOM.querySelector", {
    nodeId: root.nodeId,
    selector: (await page.locator(".character-details[open]").count())
      ? ".character-details[open] .ui-title"
      : ".formation-screen .ui-title",
  });
  const { fonts } = await session.send("CSS.getPlatformFontsForNode", { nodeId });
  expect(
    fonts.some((font) => font.isCustomFont && font.familyName.startsWith("Noto Serif JP") && font.glyphCount > 0),
  ).toBe(true);
  await session.detach();
  await page.screenshot({ path: info.outputPath(filename) });
  await writeFile(
    info.outputPath(filename.replace(/\.png$/, "-readiness.json")),
    JSON.stringify({ ...readiness, titleFonts: fonts }, null, 2),
  );
}

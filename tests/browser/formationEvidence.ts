import { expect, type Page } from "@playwright/test";

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

/** Font loading is not proof that a painted text node uses the bundled face. */
export async function expectRenderedFont(
  page: Page,
  selector: string,
  family: "Noto Serif JP" | "Noto Sans JP",
  weight: number,
) {
  await page.evaluate(() => document.fonts.ready);
  const node = page.locator(selector).first();
  await expect(node).toBeVisible();
  const session = await page.context().newCDPSession(page);
  try {
    await session.send("DOM.enable");
    await session.send("CSS.enable");
    const { root } = await session.send("DOM.getDocument");
    const { nodeId } = await session.send("DOM.querySelector", { nodeId: root.nodeId, selector });
    const { fonts } = await session.send("CSS.getPlatformFontsForNode", { nodeId });
    const used = fonts.filter((font) => font.glyphCount > 0);
    expect(used.length, `${selector}: painted glyphs`).toBeGreaterThan(0);
    for (const font of used) {
      expect(font.isCustomFont, `${selector}: ${font.familyName} must not be an OS fallback`).toBe(true);
      expect(font.familyName, selector).toMatch(new RegExp(`^${family}`));
    }
    // The weight is a documented typography contract, paired with actual face usage above.
    await expect(node).toHaveCSS("font-weight", String(weight));
    return used;
  } finally {
    await session.detach();
  }
}

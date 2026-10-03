import type { Locator } from "@playwright/test";
import { plateContrastLowerBound } from "../contrast";
import { expect } from "./coverage";

/** Scoped sufficient condition for the existing battle cards; not a general halo/image analyzer. */
export async function assertBattleCardContrast(card: Locator) {
  await expect(card).toBeVisible();
  const colors = await card.evaluate((plate) => {
    const rgb = (value: string) => {
      const match = /^rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)$/.exec(value);
      if (!match) throw new Error(`Unsupported sRGB color: ${value}`);
      return { rgb: [Number(match[1]), Number(match[2]), Number(match[3])] as const, alpha: Number(match[4] ?? 1) };
    };
    for (let element: Element | null = plate; element; element = element.parentElement) {
      const s = getComputedStyle(element);
      if (s.opacity !== "1" || s.filter !== "none" || s.mixBlendMode !== "normal")
        throw new Error("Plate proof requires no ancestor opacity/filter/blend");
      if (s.clipPath !== "none" || s.maskImage !== "none") throw new Error("Plate proof requires unmasked text");
      for (const pseudo of ["::before", "::after"])
        if (!["none", "normal"].includes(getComputedStyle(element, pseudo).content))
          throw new Error("Plate proof does not handle pseudo overlays");
    }
    const style = getComputedStyle(plate);
    if (
      style.backgroundImage !== "none" ||
      style.backgroundBlendMode !== "normal" ||
      style.backgroundClip !== "border-box"
    )
      throw new Error("Plate proof requires one constant source-over background");
    if (style.clipPath !== "none" || style.maskImage !== "none") throw new Error("Plate proof requires full coverage");
    const background = rgb(style.backgroundColor);
    const bounds = plate.getBoundingClientRect();
    const shadows = [...style.boxShadow.matchAll(/rgba?\([^)]+\)/g)].map((match) => rgb(match[0]).rgb);
    const samples = [...plate.querySelectorAll(".ally-heading strong, .ally-status, .hp-line > *")]
      .filter((text) => text.textContent?.trim())
      .map((text) => {
        const range = document.createRange();
        range.selectNodeContents(text);
        const rectangles = [...range.getClientRects()];
        if (
          !rectangles.length ||
          rectangles.some(
            (r) =>
              r.width <= 0 ||
              r.height <= 0 ||
              r.left < bounds.left ||
              r.right > bounds.right ||
              r.top < bounds.top ||
              r.bottom > bounds.bottom,
          )
        )
          throw new Error("Text is not completely covered by the plate");
        for (let element: Element | null = text; element && element !== plate; element = element.parentElement) {
          const s = getComputedStyle(element);
          if (s.clipPath !== "none" || s.maskImage !== "none") throw new Error("Text proof requires unmasked glyphs");
          for (const pseudo of ["::before", "::after"])
            if (!["none", "normal"].includes(getComputedStyle(element, pseudo).content))
              throw new Error("Text proof does not handle pseudo overlays");
          if (
            s.opacity !== "1" ||
            s.filter !== "none" ||
            s.mixBlendMode !== "normal" ||
            s.backgroundImage !== "none" ||
            s.boxShadow !== "none" ||
            rgb(s.backgroundColor).alpha !== 0
          )
            throw new Error("Text proof requires a transparent unfiltered path to the plate");
        }
        const s = getComputedStyle(text);
        const foreground = rgb(s.webkitTextFillColor);
        if (foreground.alpha !== 1 || Number.parseFloat(s.webkitTextStrokeWidth) !== 0)
          throw new Error("Text proof requires opaque unstroked glyph fill");
        return {
          text: text.textContent,
          foreground: foreground.rgb,
          shadows: [...s.textShadow.matchAll(/rgba?\([^)]+\)/g)].map((match) => rgb(match[0]).rgb),
        };
      });
    if (!samples.length) throw new Error("No plate text to check");
    return { background, shadows, samples };
  });
  const results = colors.samples.map((sample) => ({
    text: sample.text,
    minimum: plateContrastLowerBound(sample.foreground, colors.background.rgb, colors.background.alpha, [
      ...colors.shadows,
      ...sample.shadows,
    ]),
  }));
  for (const result of results) expect(result.minimum, JSON.stringify({ colors, result })).toBeGreaterThanOrEqual(4.5);
  return { colors, results };
}

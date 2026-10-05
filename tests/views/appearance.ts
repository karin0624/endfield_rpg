import type { Page } from "@playwright/test";

export async function readyPicture(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(Array.from(document.images, (image) => image.decode()));
  });
}

/** Reapply the same native focus under pointer modality; the supplied game/screen snapshot stays fixed. */
export async function pointerFocusAppearance(page: Page) {
  const handle = await page.evaluateHandle(() =>
    document.activeElement === document.body ? null : document.activeElement,
  );
  const focus = handle.asElement();
  await focus?.evaluate((element: HTMLElement) => element.blur());
  await focus?.click();
  await handle.dispose();
}

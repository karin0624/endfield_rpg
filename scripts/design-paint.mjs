import { emptyViewportReadback } from "./verify-design-bindings.mjs";

/** Initialize Chromium's full paint after the captured UI state is established. */
export async function initializeDesignPaint(page, inspect = async () => ({})) {
  const client = await page.context().newCDPSession(page);
  let timer;
  let layers;
  let emptyReadback;
  const painted = [];
  const acknowledged = new Promise((complete, reject) => {
    timer = setTimeout(() => reject(new Error("No LayerTree repaint acknowledgement within 5000ms")), 5000);
    client.on("LayerTree.layerTreeDidChange", (event) => {
      layers = event.layers ?? [];
      complete();
    });
    client.on("LayerTree.layerPainted", (event) => painted.push(event));
  });
  try {
    // Enabling Chromium's layer inspector invalidates the existing paint cache.
    // Do this after both inputs reach their requested state, without UI edits.
    await client.send("LayerTree.enable");
    await page.evaluate(() => new Promise((complete) => requestAnimationFrame(() => requestAnimationFrame(complete))));
    try {
      await acknowledged;
    } catch (error) {
      if (error.message !== "No LayerTree repaint acknowledgement within 5000ms") throw error;
      // A wholly transparent empty view can have no layer-tree change. Only
      // an unchanged all-zero viewport readback can acknowledge that case.
      const pixels = await page.screenshot({ animations: "allow", omitBackground: true });
      emptyReadback = emptyViewportReadback(pixels, page.viewportSize());
      if (!emptyReadback) throw error;
      layers = [];
    }
    const observations = await inspect(client, () => layers);
    return { acknowledged: true, layers, painted, emptyReadback, ...observations };
  } finally {
    clearTimeout(timer);
    await client.detach();
  }
}

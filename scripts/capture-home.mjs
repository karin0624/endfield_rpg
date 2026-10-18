import { preview } from "vite";
import { initializeDesignPaint } from "./design-paint.mjs";
import { assertDesignBrowserScreen, DESIGN_BROWSER_LAUNCH, DESIGN_BROWSER_SCREEN } from "./verify-design-bindings.mjs";

export async function captureHome(browser, width, height, output) {
  const server = await preview({ preview: { host: "127.0.0.1", port: 4173, strictPort: true } });
  const page = await browser.newPage({
    viewport: { width, height },
    screen: DESIGN_BROWSER_SCREEN,
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("requestfailed", (request) => errors.push(`${request.failure()?.errorText} ${request.url()}`));
  page.on("response", (response) => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
  try {
    const client = await page.context().newCDPSession(page);
    const screenInfos = await client.send("Emulation.getScreenInfos");
    const physicalScreen = assertDesignBrowserScreen(screenInfos);
    await client.detach();
    await page.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });
    for (const command of ["new-game", "accept", "home"]) {
      await page.locator(`[data-command="${command}"]`).click();
    }
    await page.locator('[data-campaign-screen="home"]').waitFor({ state: "visible" });
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((image) => image.decode()));
      await Promise.all(
        [...document.querySelectorAll("svg image")].map(async (element) => {
          const image = new Image();
          image.src = element.href.baseVal;
          await image.decode();
        }),
      );
    });
    await page.mouse.move(0, 0);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    if (errors.length) throw new Error(errors.join("\n"));
    const paintInitialization = await initializeDesignPaint(page);
    await page.screenshot({ path: output, animations: "disabled" });
    return {
      url: page.url(),
      viewport: { width, height, deviceScaleFactor: 1 },
      environment: { launch: DESIGN_BROWSER_LAUNCH, screen: DESIGN_BROWSER_SCREEN, physicalScreen, screenInfos },
      paintInitialization,
      errors,
    };
  } finally {
    await page.close();
    await new Promise((resolve) => server.httpServer.close(resolve));
  }
}

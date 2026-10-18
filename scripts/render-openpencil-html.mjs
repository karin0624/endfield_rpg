import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
import { captureHome } from "./capture-home.mjs";
import { initializeDesignPaint } from "./design-paint.mjs";
import { assertDesignBrowserScreen, DESIGN_BROWSER_LAUNCH, DESIGN_BROWSER_SCREEN } from "./verify-design-bindings.mjs";

const directory = process.argv[2];
const { width, height, verifyHome } = JSON.parse(await readFile(join(directory, "job.json"), "utf8"));
const launch = DESIGN_BROWSER_LAUNCH;
const browser = await chromium.launch(launch);
try {
  const implementation = verifyHome
    ? await captureHome(browser, width, height, join(directory, "implementation.png"))
    : undefined;
  const page = await browser.newPage({
    viewport: { width, height },
    screen: DESIGN_BROWSER_SCREEN,
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  const client = await page.context().newCDPSession(page);
  const screenInfos = await client.send("Emulation.getScreenInfos");
  const physicalScreen = assertDesignBrowserScreen(screenInfos);
  await client.detach();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("requestfailed", (request) => errors.push(`${request.failure()?.errorText} ${request.url().slice(0, 200)}`));
  await page.goto(pathToFileURL(join(directory, "frame.html")).href, { waitUntil: "networkidle" });
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
  if (errors.length) throw new Error(errors.join("\n"));
  const paintInitialization = await initializeDesignPaint(page);
  await page.screenshot({ path: join(directory, "result.png"), animations: "disabled" });
  await writeFile(
    join(directory, "result.json"),
    JSON.stringify({
      browser: browser.version(),
      environment: { launch, screen: DESIGN_BROWSER_SCREEN, physicalScreen, screenInfos },
      paintInitialization,
      errors,
      implementation,
    }),
  );
} finally {
  await browser.close();
}

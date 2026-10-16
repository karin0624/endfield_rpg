import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
import { captureHome } from "./capture-home.mjs";

const directory = process.argv[2];
const { width, height, verifyHome } = JSON.parse(await readFile(join(directory, "job.json"), "utf8"));
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--enable-unsafe-swiftshader"] });
try {
  const implementation = verifyHome
    ? await captureHome(browser, width, height, join(directory, "implementation.png"))
    : undefined;
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: "reduce" });
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
  await page.screenshot({ path: join(directory, "result.png"), animations: "disabled" });
  await writeFile(
    join(directory, "result.json"),
    JSON.stringify({ browser: browser.version(), errors, implementation }),
  );
} finally {
  await browser.close();
}

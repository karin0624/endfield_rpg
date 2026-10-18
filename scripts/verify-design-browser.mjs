import { createReadStream } from "node:fs";
import { readFile, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, resolve, sep } from "node:path";
import { chromium } from "@playwright/test";
import { comparePNG } from "./compare-png.mjs";
import { collectStoryDesigns } from "./storybook-design-manifest.mjs";
import {
  assertDesignBrowserScreen,
  assertPressedCapture,
  captureGeometry,
  clearCaptureBoundary,
  cropPNG,
  DESIGN_BROWSER_LAUNCH,
  DESIGN_BROWSER_SCREEN,
} from "./verify-design-bindings.mjs";

const directory = resolve(process.argv[2]);
const jobFile = process.argv[3] ?? "job";
const {
  jobs = [],
  mode = "compare",
  settings,
  output,
  viewport,
} = JSON.parse(await readFile(join(directory, `${jobFile}.json`), "utf8"));
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
};
const server = createServer(async (request, response) => {
  try {
    const path = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    if (path === "/favicon.ico") {
      response.writeHead(204).end();
      return;
    }
    const candidates = [resolve(directory, `.${path}`)];
    if (path.startsWith("/assets/")) candidates.push(resolve("public", `.${path}`));
    if (path.startsWith("/implementation/assets/"))
      candidates.push(resolve("public", `.${path.slice("/implementation".length)}`));
    for (const candidate of candidates) {
      if (![directory, resolve("public")].some((root) => candidate.startsWith(`${root}${sep}`))) continue;
      if (!(await stat(candidate).catch(() => undefined))?.isFile()) continue;
      response.writeHead(200, {
        "Content-Type": contentTypes[extname(candidate)] ?? "application/octet-stream",
        "Cache-Control": "no-store",
      });
      createReadStream(candidate).pipe(response);
      return;
    }
    response.writeHead(404).end();
  } catch (error) {
    response.writeHead(500).end(error.message);
  }
});
await new Promise((complete) => server.listen(0, "127.0.0.1", complete));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch(DESIGN_BROWSER_LAUNCH);
const report = { environment: { launch: DESIGN_BROWSER_LAUNCH, screen: DESIGN_BROWSER_SCREEN }, targets: [] };
async function ready(page) {
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
    const backgrounds = new Set();
    const localResources = new Set([
      location.href.split("#")[0],
      ...[...document.styleSheets].map((sheet) => sheet.href).filter(Boolean),
    ]);
    for (const element of document.querySelectorAll("*")) {
      if (!element.getClientRects().length) continue;
      for (const pseudo of [null, "::before", "::after"]) {
        const style = getComputedStyle(element, pseudo);
        if (style.visibility === "hidden" || style.display === "none") continue;
        for (const property of [style.backgroundImage, style.borderImageSource, style.maskImage])
          for (const match of property.matchAll(/url\((?:"([^"]*)"|'([^']*)'|([^)]*))\)/g)) {
            const source = match[1] ?? match[2] ?? match[3];
            const resource = new URL(source, document.baseURI);
            // Inline SVG mask/filter references may be serialized relative to
            // their external stylesheet. They are DOM resources, not images.
            if (
              resource.hash &&
              localResources.has(resource.href.split("#")[0]) &&
              document.getElementById(decodeURIComponent(resource.hash.slice(1))) instanceof SVGElement
            )
              continue;
            backgrounds.add(source);
          }
      }
    }
    await Promise.all(
      [...backgrounds].map(async (source) => {
        const image = new Image();
        image.src = source;
        await image.decode();
      }),
    );
    await new Promise((complete) => requestAnimationFrame(() => requestAnimationFrame(complete)));
  });
}

async function fontDiagnostics(page) {
  let timeout;
  try {
    return await Promise.race([
      page.evaluate(() => ({
        status: document.fonts.status,
        faces: [...document.fonts].map(({ family, style, weight, status }) => ({ family, style, weight, status })),
      })),
      new Promise((complete) => {
        timeout = setTimeout(() => complete({ error: "Font diagnostics did not respond within 1000ms" }), 1000);
      }),
    ]);
  } catch (error) {
    return { error: error.message };
  } finally {
    clearTimeout(timeout);
  }
}

async function bounds(locator) {
  return locator.evaluate((element) => {
    if (!element.getClientRects().length) return null;
    const { x, y, width, height } = element.getBoundingClientRect();
    return { x, y, width, height };
  });
}

async function interaction(page, action, deferPress = false) {
  const target = page.locator(action.selector);
  if ((await target.count()) !== 1) throw new Error(`Interaction selector must match one element: ${action.selector}`);
  if (action.type === "release") {
    if (!(await target.evaluate((element) => element.matches(":active"))))
      throw new Error(`Mouse release requires an active element: ${action.selector}`);
    await page.mouse.up();
    if (await target.evaluate((element) => element.matches(":active")))
      throw new Error(`Mouse release left the element active: ${action.selector}`);
    return;
  }
  if (action.type === "key") {
    if (!(await target.evaluate((element) => element === document.activeElement)))
      throw new Error(`Key interaction requires the focused element: ${action.selector}`);
    await page.keyboard.press(action.key);
    if (action.expectedValue !== undefined && (await target.inputValue()) !== action.expectedValue)
      throw new Error(`Key interaction changed the expected control value: ${action.selector}`);
    return;
  }
  if (action.type === "focus" || action.method === "keyboard") {
    await page.keyboard.press("Tab");
    await target.focus();
    if (!(await target.evaluate((element) => element.matches(":focus-visible"))))
      throw new Error(`Native focus-visible was not applied: ${action.selector}`);
    if (action.type === "pressed") {
      await page.keyboard.down("Space");
      if (!(await target.evaluate((element) => element.matches(":active"))))
        throw new Error(`Native keyboard :active was not applied: ${action.selector}`);
    }
  } else {
    if (action.position) {
      const point = await target.evaluate((element, position) => {
        const box = element.getBoundingClientRect();
        if (position.x < 0 || position.y < 0 || position.x >= box.width || position.y >= box.height)
          throw new Error("Hover and press positions must be inside the control");
        const x = box.x + position.x,
          y = box.y + position.y;
        const hit = document.elementFromPoint(x, y);
        if (!hit || !element.contains(hit)) throw new Error("Hover and press point must be visible and unobstructed");
        return { x, y };
      }, action.position);
      await page.mouse.move(point.x, point.y);
    } else await target.hover();
    if (action.type === "pressed" && !deferPress) await page.mouse.down();
    const expected = action.type === "pressed" && !deferPress ? ":active" : ":hover";
    if (!(await target.evaluate((element, selector) => element.matches(selector), expected)))
      throw new Error(`Native ${expected} was not applied: ${action.selector}`);
  }
}

async function pressedState(element) {
  return element.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      connected: element.isConnected,
      control:
        element instanceof HTMLInputElement
          ? "input"
          : element instanceof HTMLSelectElement
            ? "select"
            : element instanceof HTMLTextAreaElement
              ? "textarea"
              : null,
      value: "value" in element ? element.value : undefined,
      selection: {
        text: document.getSelection()?.toString() ?? "",
        start: element.selectionStart,
        end: element.selectionEnd,
        direction: element.selectionDirection,
      },
      box: element.getBoundingClientRect().toJSON(),
      states: Object.fromEntries(
        ["hover", "active", "focus", "focus-visible", "open"].map((state) => [state, element.matches(`:${state}`)]),
      ),
      style: Object.fromEntries([...style].map((property) => [property, style.getPropertyValue(property)])),
    };
  });
}

function watch(page, result) {
  page.on("requestfinished", (request) => {
    const path = new URL(request.url()).pathname;
    const asset = path.replace(/^\/implementation\//, "/");
    if (asset.startsWith("/assets/") && /\.(png|jpe?g|webp|svg|woff2?|ttf|otf)$/.test(asset)) {
      const file = `public${decodeURIComponent(asset)}`;
      result.resources ??= [];
      if (!result.resources.includes(file)) result.resources.push(file);
    }
  });
  page.on("pageerror", (error) => result.errors.push(error.message));
  page.on("requestfailed", (request) => result.errors.push(`${request.failure()?.errorText} ${request.url()}`));
  page.on("response", (response) => {
    if (response.status() >= 400) result.errors.push(`${response.status()} ${response.url()}`);
  });
}

async function matte(page, background) {
  if (!background) return;
  await page.evaluate((color) => {
    if (!CSS.supports("color", color)) throw new Error(`Invalid capture background color: ${color}`);
    document.documentElement.style.background = color;
    document.body.style.background = "transparent";
  }, background);
}

async function animationStates(page) {
  return page.evaluate(() =>
    document.getAnimations().map((animation) => ({
      id: animation.id,
      state: animation.playState,
      pending: animation.pending,
      time: typeof animation.currentTime === "number" ? animation.currentTime : animation.currentTime?.value,
    })),
  );
}

async function prepareCapture(page, background, animations = "disabled") {
  const before = await animationStates(page);
  const fastForwarded = animations === "disabled" && before.some((animation) => animation.state !== "finished");
  // Use the same public screenshot policy as the final image. Finite CSS
  // transitions must reach their endpoint before checking the full repaint.
  if (fastForwarded) await page.screenshot({ animations, omitBackground: background === "transparent" });
  return { policy: animations, fastForwarded, before, after: await animationStates(page) };
}

async function screenshot(page, path, clip, background, animations = "disabled") {
  const before = animations === "allow" ? await animationStates(page) : undefined;
  if (before?.some((animation) => animation.pending || !["paused", "finished"].includes(animation.state)))
    throw new Error("Capture requires stable paused animations");
  // A native select popup closes when Chromium changes its capture clip.
  const nativePopup = clip && (await page.locator("select:open").count()) > 0;
  const pixels = await page.screenshot({
    clip: nativePopup ? undefined : clip,
    animations,
    caret: "hide",
    omitBackground: background === "transparent",
  });
  await writeFile(path, nativePopup ? cropPNG(pixels, clip) : pixels);
  const after = before ? await animationStates(page) : undefined;
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error("Animation state changed during capture");
}

async function captureTarget(job, reference) {
  const { name, target, padding } = job;
  const result = { id: target.id, errors: [] };
  const page = await browser.newPage({
    viewport: target.viewport,
    screen: DESIGN_BROWSER_SCREEN,
    deviceScaleFactor: 1,
    reducedMotion: target.capture?.reducedMotion ?? "reduce",
  });
  watch(page, result);
  let pressedElement;
  try {
    const query = new URLSearchParams({ id: target.storyId, viewMode: "story" });
    await page.goto(reference ? `${origin}/reference/${name}.html` : `${origin}/implementation/iframe.html?${query}`, {
      waitUntil: "load",
    });
    if (!reference) {
      await page.waitForFunction(
        (id) =>
          document.documentElement.dataset.designStoryReady === id ||
          document.body.classList.contains("sb-show-errordisplay") ||
          document.body.classList.contains("sb-show-nopreview"),
        target.storyId,
      );
      if (await page.locator(".sb-errordisplay:visible, .sb-nopreview:visible").count())
        throw new Error("Storybook could not render the registered component");
      await page.mouse.move(0, 0);
      await page.evaluate(() => {
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      });
    }
    await matte(page, target.capture?.background);
    await ready(page);
    const selector = reference ? `[data-open-pencil-node-id="${job.nativeNodeId}"]` : target.capture?.selector;
    if (target.kind === "component") {
      const subject = page.locator(selector);
      if ((await subject.count()) !== 1) throw new Error(`Capture selector must match one component: ${selector}`);
      const box = await bounds(subject);
      if (!box) throw new Error("Component has no visible bounds");
      const { clip } = captureGeometry(box, padding);
      if (
        clip.x < 0 ||
        clip.y < 0 ||
        clip.x + clip.width > target.viewport.width ||
        clip.y + clip.height > target.viewport.height
      )
        throw new Error(`Component and its padding must fit the viewport: ${JSON.stringify(clip)}`);
      result.bounds = box;
      result.clip = clip;
      if (!reference)
        result.backgroundRGBA = await page.evaluate((color) => {
          const canvas = document.createElement("canvas");
          canvas.width = canvas.height = 1;
          const context = canvas.getContext("2d");
          if (color !== "transparent") {
            context.fillStyle = "#fff";
            context.fillRect(0, 0, 1, 1);
          }
          context.fillStyle = color;
          context.fillRect(0, 0, 1, 1);
          return Array.from(context.getImageData(0, 0, 1, 1).data);
        }, target.capture.background);
    }
    const actions = reference
      ? (job.nativeInteractions ?? [])
      : Array.isArray(target.interaction)
        ? target.interaction
        : target.interaction
          ? [target.interaction]
          : [];
    const deferredPress = !reference && actions.at(-1)?.type === "pressed" && actions.at(-1).method !== "keyboard";
    for (const [index, action] of actions.entries()) {
      if (reference) {
        if (action.type !== "click") throw new Error(`Unsupported saved prototype action: ${action.type}`);
        // Select the saved overlay state without pointer preparation scrolling a
        // clipped Fig frame. Product interactions still use native input above.
        await page.locator(`[data-open-pencil-node-id="${action.nodeId}"]`).dispatchEvent("click");
      } else await interaction(page, action, deferredPress && index === actions.length - 1);
    }
    await ready(page);
    await prepareCapture(page, target.capture?.background, target.capture?.animations);
    if (deferredPress) {
      const action = actions.at(-1);
      pressedElement = await page.locator(action.selector).evaluateHandle((element) => element);
      await page.mouse.down();
      const before = await pressedState(pressedElement);
      assertPressedCapture(before, before, action.expectedValue);
      result.pressed = { before, expectedValue: action.expectedValue };
    }
    if (result.errors.length) throw new Error(result.errors.join("\n"));
    const path = join(output, `${name}.${reference ? "figma" : "implementation"}.png`);
    await screenshot(page, path, result.clip, target.capture?.background, target.capture?.animations);
    if (pressedElement) {
      result.pressed.after = await pressedState(pressedElement);
      assertPressedCapture(result.pressed.before, result.pressed.after, result.pressed.expectedValue);
    }
    result.path = path;
  } catch (error) {
    result.error = error.message;
    result.fonts = await fontDiagnostics(page);
  } finally {
    await page.close();
  }
  return result;
}

try {
  report.browser = browser.version();
  if (!report.browser.startsWith("153.")) throw new Error(`Expected fixed Chromium 153; got ${report.browser}`);
  const page = await browser.newPage({
    viewport: DESIGN_BROWSER_SCREEN,
    screen: DESIGN_BROWSER_SCREEN,
    deviceScaleFactor: 1,
  });
  try {
    const client = await page.context().newCDPSession(page);
    report.environment.physicalScreen = assertDesignBrowserScreen(await client.send("Emulation.getScreenInfos"));
    await client.detach();
    if (mode === "manifest")
      report.manifest = await collectStoryDesigns({ page, storybookURL: `${origin}/implementation/`, settings });
  } finally {
    await page.close();
  }
  if (mode === "render") {
    const page = await browser.newPage({
      viewport,
      screen: DESIGN_BROWSER_SCREEN,
      deviceScaleFactor: 1,
      reducedMotion: "reduce",
    });
    try {
      const result = { errors: [] };
      watch(page, result);
      await page.goto(`${origin}/frame.html`);
      await ready(page);
      if (result.errors.length) throw new Error(result.errors.join("\n"));
      await screenshot(page, join(output, "result.png"));
    } finally {
      await page.close();
    }
  }
  if (mode === "compare")
    for (const job of jobs) {
      const implementation = await captureTarget(job, false);
      const reference = await captureTarget(job, true);
      const result = {
        id: job.target.id,
        resources: implementation.resources,
        errors: [...implementation.errors, ...reference.errors],
        error: implementation.error ?? reference.error,
        bounds: { implementation: implementation.bounds, reference: reference.bounds },
        clips: { implementation: implementation.clip, reference: reference.clip },
        artifacts:
          implementation.path && reference.path
            ? { implementation: `${job.name}.implementation.png`, native: `${job.name}.figma.png` }
            : undefined,
      };
      if (!result.error && !result.errors.length) {
        if (
          implementation.bounds &&
          (implementation.bounds.width !== reference.bounds.width ||
            implementation.bounds.height !== reference.bounds.height)
        )
          result.error = `Component dimensions differ: ${JSON.stringify(result.bounds)}`;
        result.comparison = await comparePNG(implementation.path, reference.path);
        if (job.target.kind === "component") {
          const rgba = implementation.backgroundRGBA;
          result.outset = {
            implementation: await clearCaptureBoundary(implementation.path, rgba, job.padding),
            native: await clearCaptureBoundary(reference.path, rgba, job.padding),
          };
          if (!result.outset.implementation.clear || !result.outset.native.clear)
            result.error = "Component paint reaches the capture boundary; increase its padding";
        }
      }
      report.targets.push(result);
      process.stdout.write(
        `${job.target.id}: ${result.error ?? (result.errors.length ? result.errors.join("; ") : `${result.comparison.differentPixels ?? "dimension mismatch"} pixels differ`)}\n`,
      );
    }
} finally {
  await writeFile(join(directory, `${jobFile}.result.json`), JSON.stringify(report));
  await browser.close();
  await new Promise((complete) => server.close(complete));
}

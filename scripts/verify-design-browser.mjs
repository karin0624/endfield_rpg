import { execFileSync } from "node:child_process";
import { createReadStream } from "node:fs";
import { readFile, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, resolve, sep } from "node:path";
import { chromium } from "@playwright/test";
import { initializeDesignPaint } from "./design-paint.mjs";
import {
  assertDesignBrowserScreen,
  assertNativeAnimationClock,
  assertPressedCapture,
  assertSourcePlatformPhase,
  captureCaret,
  captureGeometry,
  cropPNG,
  DESIGN_BROWSER_ARGS,
  DESIGN_BROWSER_SCREEN,
  designBrowserCapture,
  nativeAnimationTime,
  nativeGeometryMatches,
  observeCaretBitmap,
  observeSelectPopupBitmap,
} from "./verify-design-bindings.mjs";

const directory = resolve(process.argv[2]);
const { jobs, mode = "legacy" } = JSON.parse(await readFile(join(directory, "job.json"), "utf8"));
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
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
    const roots = [directory, resolve("public")];
    for (const candidate of candidates) {
      if (!roots.some((root) => candidate.startsWith(`${root}${sep}`))) continue;
      const file = await stat(candidate).catch(() => undefined);
      if (!file?.isFile()) continue;
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
let browser;
const report = {
  environment: { browserArgs: DESIGN_BROWSER_ARGS, screen: DESIGN_BROWSER_SCREEN, browserContexts: [] },
  targets: [],
};

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

async function clickVisibleTrigger(page, trigger) {
  // A locator click scrolls oversized controls into view. Prototype activation
  // must use the visible part of the saved screen without moving its viewport.
  const capture = await trigger.evaluateHandle((element) => {
    if (!element.checkVisibility()) throw new Error("Native interaction trigger is not visible");
    const bounds = element.getBoundingClientRect();
    const visible = {
      left: Math.max(0, bounds.left),
      right: Math.min(innerWidth, bounds.right),
      top: Math.max(0, bounds.top),
      bottom: Math.min(innerHeight, bounds.bottom),
    };
    const ancestors = [];
    for (let ancestor = element; ancestor; ancestor = ancestor.parentElement) {
      ancestors.push({ element: ancestor, left: ancestor.scrollLeft, top: ancestor.scrollTop });
      if (ancestor === element) continue;
      const style = getComputedStyle(ancestor);
      const box = ancestor.getBoundingClientRect();
      if (style.overflowX !== "visible") {
        visible.left = Math.max(visible.left, box.left + Number.parseFloat(style.borderLeftWidth));
        visible.right = Math.min(visible.right, box.right - Number.parseFloat(style.borderRightWidth));
      }
      if (style.overflowY !== "visible") {
        visible.top = Math.max(visible.top, box.top + Number.parseFloat(style.borderTopWidth));
        visible.bottom = Math.min(visible.bottom, box.bottom - Number.parseFloat(style.borderBottomWidth));
      }
    }
    if (visible.right <= visible.left || visible.bottom <= visible.top)
      throw new Error("Native interaction trigger is outside the visible viewport");
    for (const y of [0.5, 0.25, 0.75])
      for (const x of [0.5, 0.25, 0.75]) {
        const point = {
          x: visible.left + (visible.right - visible.left) * x,
          y: visible.top + (visible.bottom - visible.top) * y,
        };
        if (element.contains(document.elementFromPoint(point.x, point.y))) {
          const state = {
            point,
            bounds: bounds.toJSON(),
            ancestors,
            windowScroll: { x: scrollX, y: scrollY },
            element,
          };
          state.listener = (event) => {
            state.trusted = event.isTrusted && element.contains(event.target);
          };
          element.addEventListener("click", state.listener, { once: true, capture: true });
          return state;
        }
      }
    throw new Error("Native interaction trigger has no unobstructed visible point");
  });
  try {
    const point = await capture.evaluate((state) => state.point);
    await page.mouse.click(point.x, point.y);
    await ready(page);
    return await capture.evaluate((state) => {
      if (
        scrollX !== state.windowScroll.x ||
        scrollY !== state.windowScroll.y ||
        state.ancestors.some(
          ({ element, left, top }) => !element.isConnected || element.scrollLeft !== left || element.scrollTop !== top,
        )
      )
        throw new Error("Native prototype activation changed its original viewport scroll");
      if (!state.trusted) throw new Error("Native prototype activation requires an actual trusted click");
      return { point: state.point, bounds: state.bounds, scrollUnchanged: true, trusted: true };
    });
  } finally {
    await capture.evaluate((state) => state.element.removeEventListener("click", state.listener, true));
    await capture.dispose();
  }
}

async function movePlatformPointer(page, clientPoint) {
  const initial = page.platformPointerOrigin;
  if (!initial?.trusted) throw new Error("Platform pointer requires a measured trusted viewport origin");
  const origin = {
    x: initial.screen.x - initial.client.x,
    y: initial.screen.y - initial.client.y,
  };
  const point = { x: Math.round(origin.x + clientPoint.x), y: Math.round(origin.y + clientPoint.y) };
  const client = await page.context().newCDPSession(page);
  let window;
  try {
    window = await client.send("Browser.getWindowForTarget");
  } finally {
    await client.detach();
  }
  if (
    ![origin.x, origin.y, point.x, point.y].every(Number.isFinite) ||
    origin.x < window.bounds.left ||
    origin.y < window.bounds.top ||
    origin.x >= window.bounds.left + window.bounds.width ||
    origin.y >= window.bounds.top + window.bounds.height ||
    point.x < 0 ||
    point.y < 0 ||
    point.x >= DESIGN_BROWSER_SCREEN.width ||
    point.y >= DESIGN_BROWSER_SCREEN.height
  )
    throw new Error("Platform pointer position is outside its measured window or physical display");
  const observation = JSON.parse(
    execFileSync("python3", [resolve("scripts/design-pointer.py"), String(point.x), String(point.y)], {
      encoding: "utf8",
    }),
  );
  if (
    observation.point?.[0] !== point.x ||
    observation.point?.[1] !== point.y ||
    observation.after?.[0]?.rootPointer?.[0] !== point.x ||
    observation.after?.[0]?.rootPointer?.[1] !== point.y
  )
    throw new Error("Platform pointer did not reach the declared physical position");
  page.platformPointer ??= [];
  page.platformPointer.push({ origin, clientPoint, point, window, observation });
}

async function interaction(page, action, deferPress = false) {
  const target = page.locator(action.selector);
  if ((await target.count()) !== 1) throw new Error(`Interaction selector must match one element: ${action.selector}`);
  if (action.type === "pointer") {
    const box = await bounds(target);
    if (!box) throw new Error(`Pointer anchor has no bounds: ${action.selector}`);
    await movePlatformPointer(page, { x: box.x + action.position.x, y: box.y + action.position.y });
    return;
  }
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

async function observeNativeAnimationTime(page, time, { setClock = false, required = true } = {}) {
  if (time === undefined) return undefined;
  const observation = await page.evaluate(
    async ({ time, required, setClock }) => {
      const animations = document.getAnimations();
      if (!animations.length) {
        if (required) throw new Error("Native animationTime requires an active saved prototype animation");
        return { requestedTime: time, waitingForActivation: true, animations: [], programs: [] };
      }
      const owners = [...document.querySelectorAll("[data-open-pencil-prototype-animations]")];
      const programs = owners.map((owner) => {
        const ids = JSON.parse(owner.dataset.openPencilPrototypeAnimations);
        if (
          !owner.dataset.openPencilNodeId ||
          !Array.isArray(ids) ||
          !ids.length ||
          !ids.every((id) => typeof id === "string" && id.length)
        )
          throw new Error("Native prototype animation has invalid ordinary runtime identities");
        return { owner, ids };
      });
      const declared = programs.flatMap((program) => program.ids);
      if (new Set(declared).size !== declared.length || declared.length !== animations.length)
        throw new Error("Native prototype runtime and actual animation identities differ");
      for (const animation of animations) {
        const matches = programs.filter((program) => program.ids.includes(animation.id));
        if (
          matches.length !== 1 ||
          animation.timeline !== document.timeline ||
          !(animation.effect?.target instanceof Element) ||
          !animation.effect.target.hasAttribute("data-open-pencil-node-id") ||
          !matches[0].owner.contains(animation.effect.target)
        )
          throw new Error("Native animation clock requires a saved prototype owner and document timeline");
        if (setClock) animation.pause();
      }
      if (setClock) {
        await Promise.all(animations.map((animation) => animation.ready));
        for (const animation of animations) animation.currentTime = time;
        await new Promise((complete) => requestAnimationFrame(() => requestAnimationFrame(complete)));
      }
      const current = document.getAnimations();
      if (current.length !== animations.length || current.some((animation, index) => animation !== animations[index]))
        throw new Error("Native animations changed while establishing the capture clock");
      return {
        requestedTime: time,
        animations: animations.map((animation) => {
          const timing = animation.effect.getComputedTiming();
          return {
            id: animation.id,
            state: animation.playState,
            pending: animation.pending,
            time: animation.currentTime,
            targetNodeId: animation.effect.target.getAttribute("data-open-pencil-node-id"),
            playbackRate: animation.playbackRate,
            duration: timing.duration,
            iterations: timing.iterations === Infinity ? "Infinity" : timing.iterations,
            progress: timing.progress,
            currentIteration: timing.currentIteration,
          };
        }),
        programs: programs.map(({ owner, ids }) => ({
          ownerNodeId: owner.dataset.openPencilNodeId,
          animationIds: ids,
          endpoints: JSON.parse(owner.dataset.openPencilPrototypeStates),
          segments: JSON.parse(owner.dataset.openPencilPrototypeSegments),
          variantId: owner.dataset.openPencilPrototypeVariant,
          targetId: owner.dataset.openPencilPrototypeTarget,
          progress: owner.dataset.openPencilPrototypeProgress,
        })),
      };
    },
    { time, required, setClock },
  );
  if (observation.animations.length || required) assertNativeAnimationClock(time, observation.animations);
  return observation;
}

async function setNativeAnimationTime(page, time, required = true) {
  return observeNativeAnimationTime(page, time, { setClock: true, required });
}

async function prepareCapture(page, background, animations = "disabled") {
  const before = await animationStates(page);
  const fastForwarded = animations === "disabled" && before.some((animation) => animation.state !== "finished");
  // Use the same public screenshot policy as the final image. Finite CSS
  // transitions must reach their endpoint before checking the full repaint.
  if (fastForwarded) await page.screenshot({ animations, omitBackground: background === "transparent" });
  return { policy: animations, fastForwarded, before, after: await animationStates(page) };
}

async function screenshot(page, path, clip, background, animations = "disabled", caret = "hide") {
  const before = animations === "allow" ? await animationStates(page) : undefined;
  if (before?.some((animation) => animation.pending || !["paused", "finished"].includes(animation.state)))
    throw new Error(`Capture requires stable paused animations: ${JSON.stringify(before)}`);
  // A clipped Chromium capture can close native select popups. Capture the
  // unchanged viewport first, then copy the exact declared integer pixel region.
  const pixels = await page.screenshot({
    path: clip ? path.replace(/\.png$/, ".viewport.png") : path,
    animations,
    caret,
    omitBackground: background === "transparent",
  });
  if (clip) await writeFile(path, cropPNG(pixels, clip));
  const after = before ? await animationStates(page) : undefined;
  if (JSON.stringify(before) !== JSON.stringify(after))
    throw new Error(`Animation state changed during capture: ${JSON.stringify({ before, after })}`);
  return before ? { policy: animations, before, after } : undefined;
}

async function cameraBackings(client, selector, cameras, layers) {
  if (!cameras.length) return [];
  const { root } = await client.send("DOM.getDocument", { depth: 0 });
  const { nodeId } = await client.send("DOM.querySelector", { nodeId: root.nodeId, selector });
  if (!nodeId) throw new Error("Camera anchor disappeared before inspecting its backing");
  const { object: anchor } = await client.send("DOM.resolveNode", { nodeId });
  try {
    const result = [];
    for (const camera of cameras) {
      let object;
      if (camera.nodeId) {
        const { nodeId } = await client.send("DOM.querySelector", {
          nodeId: root.nodeId,
          selector: `[data-open-pencil-node-id="${camera.nodeId}"]`,
        });
        if (!nodeId) throw new Error("Native camera disappeared before inspecting its backing");
        ({ object } = await client.send("DOM.resolveNode", { nodeId }));
      } else {
        ({ result: object } = await client.send("Runtime.callFunctionOn", {
          objectId: anchor.objectId,
          functionDeclaration: "function(depth){let node=this;while(depth--&&node)node=node.parentElement;return node}",
          arguments: [{ value: camera.depth }],
        }));
      }
      if (!object.objectId) throw new Error("Camera ancestor disappeared before inspecting its backing");
      try {
        const { node } = await client.send("DOM.describeNode", { objectId: object.objectId, depth: 0 });
        const matched = [];
        for (const layer of layers ?? []) {
          if (layer.backendNodeId !== node.backendNodeId || !layer.drawsContent || !layer.width || !layer.height)
            continue;
          matched.push({
            ...layer,
            ...(await client.send("LayerTree.compositingReasons", { layerId: layer.layerId })),
          });
        }
        result.push({ depth: camera.depth, nodeId: camera.nodeId, backendNodeId: node.backendNodeId, layers: matched });
      } finally {
        await client.send("Runtime.releaseObject", { objectId: object.objectId });
      }
    }
    return result;
  } finally {
    await client.send("Runtime.releaseObject", { objectId: anchor.objectId });
  }
}

async function nativeCaretPaint(page, client, layers, covers) {
  const timed = covers.filter((cover) => cover.platform === "text-caret");
  if (!timed.length) return [];
  const targets = await page.evaluate(
    (saved) =>
      saved.map((item) => {
        const owners = document.querySelectorAll(`[data-open-pencil-node-id="${CSS.escape(item.nodeId)}"]`);
        if (owners.length !== 1) throw Error("Covered Caret needs one actual timed owner");
        const ids = JSON.parse(owners[0].dataset.openPencilPrototypeAnimations ?? "[]");
        const animations = document.getAnimations().filter((animation) => ids.includes(animation.id));
        if (animations.length !== 1 || !owners[0].contains(animations[0].effect?.target))
          throw Error("Covered Caret needs one actual saved blink target");
        const nodeId = animations[0].effect.target.dataset.openPencilNodeId;
        if (!nodeId) throw Error("Covered Caret blink has no native target identity");
        return { nodeId, ownerNodeId: item.nodeId };
      }),
    timed,
  );
  const document = await client.send("DOM.getDocument");
  const observed = [];
  for (const target of targets) {
    const found = await client.send("DOM.querySelector", {
      nodeId: document.root.nodeId,
      selector: `[data-open-pencil-node-id="${target.nodeId}"]`,
    });
    if (!found.nodeId) throw new Error("Covered Caret blink target has no live DOM node");
    const described = await client.send("DOM.describeNode", { nodeId: found.nodeId });
    const matching = layers.filter(
      (layer) => layer.backendNodeId === described.node.backendNodeId && layer.drawsContent,
    );
    if (matching.length !== 1) throw new Error("Covered Caret needs one actual native paint layer");
    const layer = matching[0],
      matrix = layer.transform;
    if (!matrix || JSON.stringify(matrix.slice(0, 12)) !== JSON.stringify([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0]))
      throw new Error("Covered Caret paint layer must have unscaled physical bounds");
    observed.push({ ...target, rectangle: { x: matrix[12], y: matrix[13], width: layer.width, height: layer.height } });
  }
  return observed;
}

async function initializePaint(
  page,
  selector = "html",
  cameras = [],
  anchor = selector,
  covers = [],
  nativeCovers = [],
) {
  const snapshot = () =>
    page.locator(selector).evaluate((element) => ({
      box: element.getBoundingClientRect().toJSON(),
      states: Object.fromEntries(
        ["hover", "active", "focus", "focus-visible", "open", "modal", "popover-open"].map((state) => [
          state,
          element.matches(`:${state}`),
        ]),
      ),
      pausedAnimations: document
        .getAnimations()
        .filter((animation) => ["paused", "finished"].includes(animation.playState))
        .map((animation) => ({
          id: animation.id,
          state: animation.playState,
          time: typeof animation.currentTime === "number" ? animation.currentTime : animation.currentTime?.value,
        })),
    }));
  const before = await snapshot();
  const paintInitialization = await initializeDesignPaint(page, async (client, currentLayers) => {
    let backings;
    let caretLayers;
    let nativeCaretLayers;
    // A layout-preserving move can replace a compositor layer while CDP is
    // describing its DOM owner. Retry that stale diagnostic against the latest
    // event's tree; never treat an unavailable layer as an absent backing.
    for (let attempt = 0; ; attempt++) {
      try {
        backings = await cameraBackings(client, anchor, cameras, currentLayers());
        caretLayers = [];
        for (const cover of covers.filter((cover) => cover.source.platform === "text-caret")) {
          const box = await bounds(page.locator(cover.source.selector));
          if (!box) throw new Error("Covered caret source has no control bounds");
          for (const layer of currentLayers().filter(
            (layer) => layer.drawsContent && layer.width === 1 && layer.height > 0,
          )) {
            const matrix = layer.transform;
            if (!matrix || JSON.stringify(matrix.slice(0, 12)) !== JSON.stringify([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0]))
              continue;
            const rectangle = { x: matrix[12], y: matrix[13], width: layer.width, height: layer.height };
            if (
              rectangle.x < box.x ||
              rectangle.y < box.y ||
              rectangle.x + rectangle.width > box.x + box.width ||
              rectangle.y + rectangle.height > box.y + box.height
            )
              continue;
            const reasons = await client.send("LayerTree.compositingReasons", { layerId: layer.layerId });
            if (reasons.compositingReasonIds.includes("Caret"))
              caretLayers.push({ selector: cover.source.selector, rectangle, reasonIds: reasons.compositingReasonIds });
          }
        }
        nativeCaretLayers = await nativeCaretPaint(page, client, currentLayers(), nativeCovers);
        break;
      } catch (error) {
        if (attempt === 2 || !error.message.includes("No layer matching given id found")) throw error;
        await page.evaluate(() => new Promise(requestAnimationFrame));
      }
    }
    return { cameraBackings: backings, caretLayers, nativeCaretLayers };
  });
  const after = await snapshot();
  if (JSON.stringify(before) !== JSON.stringify(after))
    throw new Error(`Paint initialization changed component state: ${JSON.stringify({ before, after })}`);
  return { ...paintInitialization, before, after };
}

async function observeSourceComposites(page, target, caretLayers) {
  const observations = [];
  for (const cover of target.covers ?? []) {
    const locator = page.locator(cover.source.selector);
    if ((await locator.count()) !== 1)
      throw new Error("Covered source selector must identify one actual platform control");
    const observed = await locator.evaluate((element, source) => {
      const control =
        element instanceof HTMLInputElement
          ? "input"
          : element instanceof HTMLTextAreaElement
            ? "textarea"
            : element instanceof HTMLSelectElement
              ? "select"
              : null;
      const style = getComputedStyle(element);
      const color = style.caretColor === "auto" ? style.color : style.caretColor;
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const context = canvas.getContext("2d");
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      const observed = {
        selector: source.selector,
        platform: source.platform,
        control,
        connected: element.isConnected,
        focused: document.activeElement === element,
        disabled: element.disabled,
        readOnly: element.readOnly,
        open: element.matches(":open"),
        value: element.value,
        bounds: element.getBoundingClientRect().toJSON(),
        caretColor: Array.from(context.getImageData(0, 0, 1, 1).data),
      };
      if (source.platform === "select-popup" && element instanceof HTMLSelectElement) {
        context.clearRect(0, 0, 1, 1);
        context.fillStyle = style.backgroundColor;
        context.fillRect(0, 0, 1, 1);
        Object.assign(observed, {
          multiple: element.multiple,
          size: element.size,
          selectedIndex: element.selectedIndex,
          colorScheme: style.colorScheme,
          background: Array.from(context.getImageData(0, 0, 1, 1).data),
          plainOptions:
            [...element.children].every((child) => child instanceof HTMLOptionElement) &&
            [...element.options].every(
              (option) =>
                !option.hidden &&
                getComputedStyle(option).display !== "none" &&
                getComputedStyle(option).visibility === "visible",
            ),
          options: [...element.options].map((option) => ({
            label: option.label,
            value: option.value,
            disabled: option.disabled,
            font: getComputedStyle(option).font,
          })),
        });
        if (new Set(observed.options.map((option) => option.font)).size !== 1)
          throw new Error("Popup coverage requires uniform native-picker option typography");
      }
      return observed;
    }, cover.source);
    if (cover.source.platform === "text-caret") {
      const matches = caretLayers.filter((layer) => layer.selector === cover.source.selector);
      if (matches.length !== 1) throw new Error("Covered source needs one measured actual Caret layer");
      observed.caret = matches[0];
      observed.policy = captureCaret(target);
    }
    assertSourcePlatformPhase(cover.source, observed);
    observations.push(observed);
  }
  return observations;
}

async function observeNativeComposites(page, expected, animation, caretLayers = [], interactions = []) {
  return page.evaluate(
    ({ expected, animation, caretLayers, interactions }) => {
      const unique = (id) => {
        const nodes = document.querySelectorAll(`[data-open-pencil-node-id="${CSS.escape(id)}"]`);
        if (nodes.length !== 1) throw Error(`Covered native node must occur exactly once: ${id}`);
        return nodes[0];
      };
      return expected.map((saved) => {
        const node = unique(saved.nodeId),
          owner = unique(saved.ownerNodeId);
        const visible = (element) => {
          for (let current = element; current; current = current.parentElement) {
            const style = getComputedStyle(current);
            if (style.display === "none" || style.visibility !== "visible") return false;
          }
          return true;
        };
        const paint = [];
        for (const item of saved.paintNodes) {
          const element = unique(item.nodeId);
          if (!node.contains(element) || !visible(element)) continue;
          const box = element.getBoundingClientRect(),
            inset = item.outsets;
          const bounds = {
            x: box.x - inset.left,
            y: box.y - inset.top,
            width: box.width + inset.left + inset.right,
            height: box.height + inset.top + inset.bottom,
          };
          if (!(bounds.width > 0 && bounds.height > 0)) continue;
          // Internal clips are part of the component's own design. A clipping
          // ancestor outside it must not conceal one of its required outsets.
          for (let parent = node.parentElement; parent; parent = parent.parentElement) {
            const style = getComputedStyle(parent),
              clip = parent.getBoundingClientRect();
            if (
              (style.overflowX !== "visible" && (bounds.x < clip.left || bounds.x + bounds.width > clip.right)) ||
              (style.overflowY !== "visible" && (bounds.y < clip.top || bounds.y + bounds.height > clip.bottom))
            )
              throw Error("An external ancestor clips covered component paint");
          }
          paint.push(bounds);
        }
        let overlay;
        if (saved.platform === "select-popup") {
          const roots = document.querySelectorAll(
            `[data-open-pencil-overlay="${CSS.escape(saved.overlay.destinationId)}"]`,
          );
          if (roots.length !== 1) throw Error("Covered popup requires one real saved overlay destination");
          const root = roots[0],
            trigger = unique(saved.overlay.triggerNodeId);
          const activations = interactions.filter((action) => action.nodeId === saved.overlay.triggerNodeId);
          if (node.getAnimations({ subtree: true }).length)
            throw Error("Covered popup must retain its static saved main");
          overlay = {
            destinationId: saved.overlay.destinationId,
            triggerNodeId: saved.overlay.triggerNodeId,
            mainId: saved.entryMainId,
            open: root.matches(":modal, :popover-open"),
            trusted: activations.length === 1 && activations[0].activation.trusted === true,
            activationCount: activations.length,
            belongsToOwner: owner.contains(trigger) && root.contains(node),
          };
        }
        const bounds = node.getBoundingClientRect();
        return {
          nodeId: saved.nodeId,
          ownerNodeId: saved.ownerNodeId,
          connected: node.isConnected,
          visible: visible(node),
          belongsToOwner: overlay ? overlay.belongsToOwner : owner.contains(node),
          ...(overlay
            ? { overlay, bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height } }
            : {}),
          properties: saved.properties,
          paint,
          animation,
          ...(saved.platform === "text-caret"
            ? { caret: caretLayers.filter((layer) => layer.ownerNodeId === saved.nodeId) }
            : {}),
        };
      });
    },
    { expected, animation, caretLayers, interactions },
  );
}

async function initializeNativeLayout(page, nodeId) {
  return page.locator(`[data-open-pencil-node-id="${nodeId}"]`).evaluate((element) => {
    const parent = element.parentElement;
    if (!parent) throw new Error("Native subject has no layout parent");
    const before = element.getBoundingClientRect().toJSON();
    const html = element.outerHTML;
    const next = element.nextSibling;
    // The capture camera can establish a different containing block or top
    // layer. Build the static native subject's layout in that final context.
    parent.removeChild(element);
    void parent.offsetWidth;
    parent.insertBefore(element, next);
    const after = element.getBoundingClientRect().toJSON();
    if (JSON.stringify(before) !== JSON.stringify(after) || html !== element.outerHTML)
      throw new Error(`Native layout initialization changed geometry or DOM: ${JSON.stringify({ before, after })}`);
    return { before, after, sameNode: element.parentElement === parent && element.nextSibling === next };
  });
}

async function initializeComponentLayout(page, selector, platformControl) {
  // Editing state and native popup windows extend beyond an input's DOM tree.
  // Keep their established widget state through the ordinary paint/readback.
  if (platformControl) return { atomic: false, platformControl };
  return page.locator(selector).evaluate(async (subject) => {
    const element = subject.closest(":modal, :popover-open") ?? subject;
    const parent = element.parentElement;
    if (!parent || typeof parent.moveBefore !== "function")
      throw new Error("State-preserving component layout requires Element.moveBefore");
    const next = element.nextSibling;
    const order = [...parent.childNodes];
    const active = document.activeElement;
    const nodes = [element, ...element.querySelectorAll("*")];
    const html = element.outerHTML;
    const snapshot = () => ({
      nodes: nodes.map((node) => {
        const style = getComputedStyle(node);
        return {
          box: node.getBoundingClientRect().toJSON(),
          style: [...style].map((key) => [key, style.getPropertyValue(key)]),
          states: [
            "hover",
            "active",
            "focus",
            "focus-visible",
            "open",
            "modal",
            "popover-open",
            "disabled",
            "checked",
          ].map((state) => node.matches(`:${state}`)),
          scroll: [node.scrollLeft, node.scrollTop],
          selection:
            "selectionStart" in node ? [node.selectionStart, node.selectionEnd, node.selectionDirection] : null,
        };
      }),
      scroll: [scrollX, scrollY],
      animations: document.getAnimations().map((animation) => ({
        state: animation.playState,
        pending: animation.pending,
        time: typeof animation.currentTime === "number" ? animation.currentTime : animation.currentTime?.value,
      })),
    });
    const before = snapshot();
    parent.moveBefore(element, null);
    void element.getBoundingClientRect();
    parent.moveBefore(element, next);
    const after = snapshot();
    const restored = [element, ...element.querySelectorAll("*")];
    if (
      JSON.stringify(before) !== JSON.stringify(after) ||
      html !== element.outerHTML ||
      active !== document.activeElement ||
      order.length !== parent.childNodes.length ||
      order.some((node, index) => node !== parent.childNodes[index]) ||
      nodes.length !== restored.length ||
      nodes.some((node, index) => node !== restored[index])
    )
      throw new Error(
        "Atomic component layout changed DOM, geometry, styles, states, selection, scroll, animation or node order",
      );
    const digest = async (value) =>
      [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value))))]
        .map((value) => value.toString(16).padStart(2, "0"))
        .join("");
    return {
      atomic: true,
      unchanged: true,
      rootTag: element.tagName,
      subjectTag: subject.tagName,
      nodeCount: nodes.length,
      before: before.nodes[0].box,
      after: after.nodes[0].box,
      beforeSHA256: await digest(before),
      afterSHA256: await digest(after),
    };
  });
}

async function preserveCameraBackings(page, nodeId, contexts = []) {
  const backed = contexts.filter((context) => context.compositing?.layers.length);
  if (!backed.length) return [];
  return page.evaluate(
    ({ nodeId, contexts }) => {
      const subject = document.querySelector(`[data-open-pencil-node-id="${nodeId}"]`);
      if (!subject) throw new Error("Native camera has no subject");
      const snapshot = () =>
        [subject, ...subject.querySelectorAll("*")].map((element) => {
          const style = getComputedStyle(element);
          return {
            element,
            box: JSON.stringify(element.getBoundingClientRect().toJSON()),
            style: JSON.stringify([...style].map((property) => [property, style.getPropertyValue(property)])),
          };
        });
      const before = snapshot();
      const result = [];
      for (const context of contexts) {
        const camera = document.querySelector(`[data-open-pencil-node-id="${context.nodeId}"]`);
        if (!camera || camera === subject || !camera.contains(subject))
          throw new Error("Compositor backing must belong to an external camera ancestor");
        const box = camera.getBoundingClientRect().toJSON();
        const parent = camera.parentNode;
        const next = camera.nextSibling;
        const previous = getComputedStyle(camera).willChange;
        // A scrolling ancestor needs a scroll backing; an opacity backing can
        // flatten its border and contents into a different raster surface.
        // Neither hint introduces a transform containing block or UI styles.
        const backing = [context.overflowX, context.overflowY].some((value) => ["auto", "scroll"].includes(value))
          ? "scroll-position"
          : "opacity";
        const properties = previous
          .split(",")
          .map((property) => property.trim())
          .filter((property) => property !== "auto");
        if (!properties.includes("transform") && !properties.includes(backing)) properties.push(backing);
        camera.style.willChange = properties.join(", ");
        const after = camera.getBoundingClientRect().toJSON();
        if (
          JSON.stringify(box) !== JSON.stringify(after) ||
          camera.parentNode !== parent ||
          camera.nextSibling !== next
        )
          throw new Error("Camera backing changed its geometry or tree order");
        result.push({ nodeId: context.nodeId, before: previous, after: getComputedStyle(camera).willChange, box });
      }
      const after = snapshot();
      if (
        before.length !== after.length ||
        before.some(
          (item, index) =>
            item.element !== after[index].element || item.box !== after[index].box || item.style !== after[index].style,
        )
      )
        throw new Error("Camera backing changed native UI geometry, style or tree order");
      return result.map((item) => ({ ...item, nativeStyleUnchanged: true, nativeGeometryUnchanged: true }));
    },
    { nodeId, contexts: backed },
  );
}

async function preserveDocumentEnvironment(page, nodeId, environment) {
  if (!environment) return;
  return page.evaluate(
    ({ nodeId, environment }) => {
      const subject = document.querySelector(`[data-open-pencil-node-id="${nodeId}"]`);
      if (!subject) throw new Error("Native document environment has no subject");
      const measure = () => ({
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
        scrollX,
        scrollY,
      });
      const snapshot = () =>
        [subject, ...subject.querySelectorAll("*")].map((element) => {
          const style = getComputedStyle(element);
          return {
            element,
            parent: element.parentNode,
            next: element.nextSibling,
            box: JSON.stringify(element.getBoundingClientRect().toJSON()),
            style: JSON.stringify([...style].map((property) => [property, style.getPropertyValue(property)])),
          };
        });
      const before = measure();
      const elements = snapshot();
      const html = subject.outerHTML;
      // Offscreen source content can establish the document's scroll surface.
      // Keep that external geometry without copying any of its paint or UI.
      if (before.width < environment.width || before.height < environment.height) {
        const extent = document.createElement("div");
        extent.ariaHidden = "true";
        Object.assign(extent.style, {
          position: "absolute",
          left: "0px",
          top: "0px",
          width: `${environment.width}px`,
          height: `${environment.height}px`,
          visibility: "hidden",
          pointerEvents: "none",
        });
        document.body.append(extent);
      }
      window.scrollTo(environment.scrollX, environment.scrollY);
      const after = measure();
      if (JSON.stringify(after) !== JSON.stringify(environment))
        throw new Error(
          `Document camera geometry differs: ${JSON.stringify({ requested: environment, before, after })}`,
        );
      const observed = snapshot();
      if (
        html !== subject.outerHTML ||
        elements.length !== observed.length ||
        elements.some((element, index) => {
          const other = observed[index];
          return (
            element.element !== other.element ||
            element.parent !== other.parent ||
            element.next !== other.next ||
            element.box !== other.box ||
            element.style !== other.style
          );
        })
      )
        throw new Error("Document camera changed native UI geometry, style or tree order");
      return {
        requested: environment,
        before,
        after,
        nativeStyleUnchanged: true,
        nativeGeometryUnchanged: true,
        nativeTreeUnchanged: true,
      };
    },
    { nodeId, environment },
  );
}

async function observeImplementationState(page, target, result) {
  if (target.capture?.selector) {
    const node = page.locator(target.capture.selector);
    if ((await node.count()) !== 1)
      throw new Error(`Capture selector must match one element: ${target.capture.selector}`);
    result.bounds.element = await bounds(node);
    result.subjectEnvironment = await node.evaluate((element) => ({
      topLayer: element.matches(":modal") ? "dialog" : element.matches(":popover-open") ? "popover" : null,
      platformControl:
        element instanceof HTMLInputElement
          ? `input:${element.type}`
          : element instanceof HTMLSelectElement
            ? "select"
            : element instanceof HTMLTextAreaElement
              ? "textarea"
              : null,
    }));
  }
  if (result.bounds)
    result.documentEnvironment = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
      scrollX,
      scrollY,
    }));
}

async function captureImplementation({ name, target, padding }) {
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
    const query = new URLSearchParams({
      module: target.fixture.module,
      case: target.fixture.case,
      props: JSON.stringify(target.fixture.props ?? {}),
    });
    await page.goto(`${origin}/implementation/tests/fixtures/design-view.html?${query}`, { waitUntil: "load" });
    if (result.errors.length) throw new Error(result.errors.join("\n"));
    await page.waitForFunction(() => window.designStatus && window.designStatus.state !== "pending");
    const status = await page.evaluate(() => window.designStatus);
    if (status.state !== "ready") throw new Error(status.error ?? "Implementation fixture failed");
    const pointerOrigin = designBrowserCapture(target).headless
      ? undefined
      : await page.evaluateHandle(() => {
          const observer = { initial: null };
          observer.listener = (event) => {
            if (event.isTrusted && !observer.initial)
              observer.initial = {
                trusted: true,
                client: { x: event.clientX, y: event.clientY },
                screen: { x: event.screenX, y: event.screenY },
              };
          };
          document.addEventListener("mousemove", observer.listener, true);
          return observer;
        });
    try {
      await page.mouse.move(0, 0);
      if (pointerOrigin) page.platformPointerOrigin = await pointerOrigin.evaluate((observer) => observer.initial);
    } finally {
      if (pointerOrigin) {
        await pointerOrigin.evaluate((observer) => document.removeEventListener("mousemove", observer.listener, true));
        await pointerOrigin.dispose();
      }
    }
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    });
    await matte(page, target.capture?.background);
    await ready(page);
    if (target.capture?.selector) {
      const anchor = page.locator(target.capture.anchor ?? target.capture.selector);
      if ((await anchor.count()) !== 1) throw new Error("Capture anchor must match one element");
      const nominal = await bounds(anchor);
      if (!nominal) throw new Error("Capture anchor must have nominal visible bounds before interaction");
      const geometry = captureGeometry(nominal, padding);
      if (
        target.capture.phase &&
        (target.capture.phase.x !== geometry.phase.x || target.capture.phase.y !== geometry.phase.y)
      )
        throw new Error(
          `Declared capture phase differs from the nominal implementation: ${JSON.stringify({ declared: target.capture.phase, actual: geometry.phase })}`,
        );
      const clip = geometry.clip;
      if (
        clip.x < 0 ||
        clip.y < 0 ||
        clip.x + clip.width > target.viewport.width ||
        clip.y + clip.height > target.viewport.height
      )
        throw new Error(`Component and its outset must fit the viewport: ${JSON.stringify(clip)}`);
      const sourceContexts = await anchor.evaluate((element) => {
        const contexts = [];
        let nearestFixed = null;
        let depth = 0;
        // The target's own transform belongs to the native component. Only its
        // surrounding coordinate systems belong to the shared capture camera.
        // A top-layer target has no DOM paint ancestors.
        for (
          let parent = element.matches(":modal, :popover-open") ? null : element.parentElement;
          parent;
          parent = parent.parentElement
        ) {
          depth++;
          const style = getComputedStyle(parent);
          const { x, y, width, height } = parent.getBoundingClientRect();
          const typed = parent.computedStyleMap().get("transform");
          const translations =
            style.transform !== "none" &&
            [...typed].every(
              (part) =>
                part.constructor.name === "CSSTranslate" &&
                part.z.value === 0 &&
                [part.x, part.y].every((axis) => ["px", "percent"].includes(axis.unit)),
            );
          const context = {
            depth,
            x,
            y,
            width,
            height,
            position: style.position,
            visibility: style.visibility,
            isolation: style.isolation,
            borderRadius: style.borderRadius,
            borderLeft: style.borderLeftWidth,
            borderTop: style.borderTopWidth,
            borderRight: style.borderRightWidth,
            borderBottom: style.borderBottomWidth,
            padding: style.padding,
            overflowX: style.overflowX,
            overflowY: style.overflowY,
            topLayer: parent.matches(":modal") ? "dialog" : parent.matches(":popover-open") ? "popover" : null,
            transform: translations ? typed.toString() : "none",
            translation: translations
              ? [...typed].reduce(
                  (sum, part) => ({
                    x: sum.x + part.x.value * (part.x.unit === "percent" ? width / 100 : 1),
                    y: sum.y + part.y.value * (part.y.unit === "percent" ? height / 100 : 1),
                  }),
                  { x: 0, y: 0 },
                )
              : { x: 0, y: 0 },
            willChange: style.willChange,
          };
          if (style.position === "fixed" && style.transform === "none" && !nearestFixed) nearestFixed = context;
          if (
            width > 0 &&
            height > 0 &&
            (style.position === "fixed" ||
              translations ||
              style.willChange.includes("transform") ||
              style.isolation === "isolate")
          )
            contexts.push(context);
          if (parent.matches(":modal, :popover-open")) break;
        }
        return { contexts: contexts.reverse(), nearestFixed };
      });
      result.bounds = {
        nominal,
        capture: clip,
        implementationPhase: geometry.phase,
        paintContext: sourceContexts.nearestFixed,
        paintContexts: sourceContexts.contexts,
      };
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
    const actions = Array.isArray(target.interaction)
      ? target.interaction
      : target.interaction
        ? [target.interaction]
        : [];
    const deferredPress =
      actions.at(-1)?.type === "pressed" && actions.at(-1).method !== "keyboard" ? actions.at(-1) : undefined;
    for (const [index, action] of actions.entries())
      await interaction(page, action, deferredPress !== undefined && index === actions.length - 1);
    await ready(page);
    result.animationPreparation = await prepareCapture(page, target.capture?.background, target.capture?.animations);
    await observeImplementationState(page, target, result);
    if (deferredPress) {
      pressedElement = await page.locator(deferredPress.selector).evaluateHandle((element) => element);
      const started = performance.now();
      await page.mouse.down();
      await ready(page);
      result.pressedAnimationPreparation = await prepareCapture(
        page,
        target.capture?.background,
        target.capture?.animations,
      );
      await observeImplementationState(page, target, result);
      const before = await pressedState(pressedElement);
      assertPressedCapture(before, before, deferredPress.expectedValue);
      result.pressedCapture = {
        selector: deferredPress.selector,
        expectedValue: deferredPress.expectedValue,
        before,
        preparationMs: performance.now() - started,
      };
    }
    if (result.errors.length) throw new Error(result.errors.join("\n"));
    if (result.bounds)
      result.layoutInitialization = await initializeComponentLayout(
        page,
        target.capture.selector,
        result.subjectEnvironment.platformControl,
      );
    result.paintInitialization = await initializePaint(
      page,
      target.capture?.selector,
      result.bounds?.paintContexts,
      target.capture?.anchor ?? target.capture?.selector,
      target.covers,
    );
    for (const context of result.bounds?.paintContexts ?? [])
      context.compositing = result.paintInitialization.cameraBackings.find(
        (backing) => backing.depth === context.depth,
      );
    const sourceComposites = await observeSourceComposites(page, target, result.paintInitialization.caretLayers);
    result.composites = (target.covers ?? []).map((cover, index) => ({
      component: cover.component,
      state: cover.state,
      clip: result.bounds?.capture ?? { x: 0, y: 0, ...target.viewport },
      source: { before: sourceComposites[index] },
    }));
    const popupCoverage = (target.covers ?? []).some((cover) => cover.source.platform === "select-popup");
    const popupFiles = popupCoverage
      ? {
          before: join(directory, `${name}.platform-before.png`),
          capture: join(directory, `${name}.implementation.png`),
          after: join(directory, `${name}.platform-after.png`),
        }
      : undefined;
    if (popupFiles)
      await screenshot(
        page,
        popupFiles.before,
        result.bounds?.capture,
        target.capture?.background,
        target.capture?.animations,
        captureCaret(target),
      );
    result.animationCapture = await screenshot(
      page,
      join(directory, `${name}.implementation.png`),
      result.bounds?.capture,
      target.capture?.background,
      target.capture?.animations,
      captureCaret(target),
    );
    if (pressedElement) {
      const sameElement = await page
        .locator(result.pressedCapture.selector)
        .evaluate((current, original) => current === original, pressedElement);
      if (!sameElement) throw new Error("Pressed control was replaced during capture");
      result.pressedCapture.after = await pressedState(pressedElement);
      assertPressedCapture(
        result.pressedCapture.before,
        result.pressedCapture.after,
        result.pressedCapture.expectedValue,
      );
    }
    if (page.platformPointer) result.platformPointer = page.platformPointer;
    if (popupFiles)
      await screenshot(
        page,
        popupFiles.after,
        result.bounds?.capture,
        target.capture?.background,
        target.capture?.animations,
        captureCaret(target),
      );
    const sourceAfter = await observeSourceComposites(page, target, result.paintInitialization.caretLayers);
    const sourcePixels = target.covers?.some((cover) => cover.source.platform === "text-caret")
      ? await readFile(join(directory, `${name}.implementation.png`))
      : undefined;
    for (const [index, cover] of (target.covers ?? []).entries()) {
      const proof = result.composites[index];
      proof.source.after = sourceAfter[index];
      if (JSON.stringify(proof.source.before) !== JSON.stringify(proof.source.after))
        throw new Error("Covered source platform state changed during capture");
      if (cover.source.platform === "text-caret")
        proof.source.bitmap = observeCaretBitmap(
          sourcePixels,
          proof.clip,
          proof.source.before.caret.rectangle,
          proof.source.before.caretColor,
          cover.source.phase,
        );
      if (cover.source.platform === "select-popup") {
        proof.source.bitmaps = {};
        for (const [phase, file] of Object.entries(popupFiles))
          proof.source.bitmaps[phase] = observeSelectPopupBitmap(
            await readFile(file),
            proof.clip,
            proof.source.before,
            cover.source.highlightedIndex,
          );
        const pointerActions = (Array.isArray(target.interaction) ? target.interaction : [target.interaction]).filter(
          (action) => action?.type === "pointer" && action.selector === cover.source.selector,
        );
        if (pointerActions.length) {
          if (pointerActions.length !== 1 || page.platformPointer?.length !== 1)
            throw Error("Popup coverage requires one unambiguous platform pointer action");
          const pointer = page.platformPointer[0],
            received = pointer.observation.after.at(-1);
          proof.source.pointer = {
            origin: pointer.origin,
            point: pointer.point,
            window: { x: received.origin[0], y: received.origin[1], width: received.size[0], height: received.size[1] },
          };
        }
      }
    }
  } catch (error) {
    result.error = error.message;
    result.fonts = await fontDiagnostics(page);
  } finally {
    await page.close();
  }
  return result;
}

async function legacyCamera(page, result) {
  return page.locator(".op-stage").evaluate((stage, camera) => {
    const global = {
      x: camera.capture.x + camera.implementationPhase.x,
      y: camera.capture.y + camera.implementationPhase.y,
    };
    const context = camera.paintContext;
    if (context) {
      const parent = document.createElement("div");
      Object.assign(parent.style, {
        position: "fixed",
        left: `${context.x}px`,
        top: `${context.y}px`,
        width: `${context.width}px`,
        height: `${context.height}px`,
        background: "transparent",
        overflow: "visible",
        boxSizing: "border-box",
        borderStyle: "solid",
        borderColor: "transparent",
        borderLeftWidth: context.borderLeft ?? "0px",
        borderTopWidth: context.borderTop ?? "0px",
        borderRightWidth: context.borderRight ?? "0px",
        borderBottomWidth: context.borderBottom ?? "0px",
        padding: context.padding ?? "0px",
      });
      stage.parentElement.append(parent);
      parent.append(stage);
    }
    const local = context
      ? {
          x: global.x - context.x - Number.parseFloat(context.borderLeft ?? 0),
          y: global.y - context.y - Number.parseFloat(context.borderTop ?? 0),
        }
      : global;
    Object.assign(stage.style, {
      position: "absolute",
      left: `${local.x}px`,
      top: `${local.y}px`,
      overflow: "visible",
      transform: "none",
      transformOrigin: "0 0",
    });
    const layout = stage.getBoundingClientRect(),
      residual = { x: global.x - layout.x, y: global.y - layout.y };
    if (residual.x || residual.y) stage.style.transform = `translate(${residual.x}px, ${residual.y}px)`;
    return {
      requestedOrigin: global,
      layoutOrigin: { x: layout.x, y: layout.y },
      residualTranslation: residual,
      paintContext: context,
    };
  }, result.bounds);
}

async function subjectEnvironment(page, nodeId, environment) {
  if (!environment?.topLayer) return;
  return page.locator(`[data-open-pencil-node-id="${nodeId}"]`).evaluate((original, environment) => {
    const before = original.getBoundingClientRect().toJSON();
    const computed = getComputedStyle(original);
    // Changing the element's top-layer role must not import UA dialog paint or
    // replace any authored native paint, clipping, layout or transform.
    const defaults = Object.fromEntries(
      [
        "position",
        "display",
        "box-sizing",
        "margin",
        "padding",
        "border",
        "background",
        "outline",
        "min-width",
        "min-height",
        "max-width",
        "max-height",
        "overflow-x",
        "overflow-y",
        "left",
        "top",
      ].map((property) => [property, computed.getPropertyValue(property)]),
    );
    let element = original;
    if (environment.topLayer === "dialog") {
      element = document.createElement("dialog");
      for (const attribute of original.attributes) element.setAttribute(attribute.name, attribute.value);
      element.append(...original.childNodes);
      original.replaceWith(element);
    }
    for (const [property, value] of Object.entries(defaults)) element.style.setProperty(property, value);
    element.style.right = "auto";
    element.style.bottom = "auto";
    element.setAttribute("data-design-capture-top-layer", "");
    const backdrop = document.createElement("style");
    backdrop.textContent = "[data-design-capture-top-layer]::backdrop{background:transparent}";
    document.head.append(backdrop);
    if (environment.topLayer === "dialog") element.showModal();
    else {
      element.popover = "manual";
      element.showPopover();
    }
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    const placed = element.getBoundingClientRect();
    const placement = getComputedStyle(element);
    element.style.left = `${Number.parseFloat(placement.left) + before.x - placed.x}px`;
    element.style.top = `${Number.parseFloat(placement.top) + before.y - placed.y}px`;
    const after = element.getBoundingClientRect().toJSON();
    if (["x", "y", "width", "height"].some((axis) => before[axis] !== after[axis]))
      throw new Error(`Top-layer environment changed native geometry: ${JSON.stringify({ before, after })}`);
    return { topLayer: environment.topLayer, before, after };
  }, environment);
}

async function captureReference(job, result) {
  if (result.error || result.errors.length) return result;
  if (job.preparationError) return { ...result, error: job.preparationError };
  const {
    name,
    target,
    nativeNodeId,
    cameraNodeId,
    contextNodeId,
    cameraContexts,
    nativeScroll,
    nativeInteractions = [],
    sourceGeometry,
    padding,
  } = job;
  const page = await browser.newPage({
    viewport: target.viewport,
    screen: DESIGN_BROWSER_SCREEN,
    deviceScaleFactor: 1,
    reducedMotion: target.capture?.reducedMotion ?? "reduce",
  });
  watch(page, result);
  try {
    await page.goto(`${origin}/reference/${name}.html`, { waitUntil: "load" });
    await matte(page, target.capture?.background);
    await ready(page);
    result.nativeAnimationClockInitial = await setNativeAnimationTime(page, nativeAnimationTime(target), false);
    if (cameraContexts) {
      for (const [index, context] of cameraContexts.entries()) {
        let container = index > 0 ? cameraContexts[index - 1] : null;
        if (context.position === "fixed")
          container = cameraContexts
            .slice(0, index)
            .findLast((ancestor) => ancestor.transform !== "none" || ancestor.willChange.includes("transform"));
        await page.locator(`[data-open-pencil-node-id="${context.nodeId}"]`).evaluate(
          (original, placement) => {
            const { context, container } = placement;
            let element = original;
            if (context.topLayer === "dialog") {
              const dialog = document.createElement("dialog");
              for (const attribute of original.attributes) dialog.setAttribute(attribute.name, attribute.value);
              dialog.append(...original.childNodes);
              original.replaceWith(dialog);
              element = dialog;
            }
            if (context.topLayer) {
              Object.assign(element.style, {
                margin: "0",
                inset: "auto",
                maxWidth: "none",
                maxHeight: "none",
                boxSizing: "border-box",
                borderStyle: "solid",
                borderColor: "transparent",
                borderLeftWidth: context.borderLeft,
                borderTopWidth: context.borderTop,
                borderRightWidth: context.borderRight,
                borderBottomWidth: context.borderBottom,
                background: "transparent",
                outline: "none",
              });
              element.setAttribute("data-design-capture-top-layer", "");
              const backdrop = document.createElement("style");
              backdrop.textContent = "[data-design-capture-top-layer]::backdrop{background:transparent}";
              document.head.append(backdrop);
            }
            Object.assign(element.style, {
              position: context.position === "fixed" ? "fixed" : "absolute",
              left: `${context.x - (container?.x ?? 0) - Number.parseFloat(container?.borderLeft ?? 0) - context.translation.x}px`,
              top: `${context.y - (container?.y ?? 0) - Number.parseFloat(container?.borderTop ?? 0) - context.translation.y}px`,
              padding: context.padding,
              overflowX: context.overflowX,
              overflowY: context.overflowY,
              transform: context.transform,
              transformOrigin: "0 0",
              willChange: context.willChange,
              isolation: context.isolation ?? "auto",
              borderRadius: context.borderRadius ?? "0px",
            });
            if (context.topLayer === "dialog") element.showModal();
            if (context.topLayer === "popover") {
              element.popover = "manual";
              element.showPopover();
            }
          },
          { context, container },
        );
      }
    } else if (contextNodeId)
      await page.locator(`[data-open-pencil-node-id="${contextNodeId}"]`).evaluate((element, context) => {
        // Capture context follows the actual DOM coordinate system, independently
        // of Figma's scroll-frame containment and without changing any UI node.
        element.style.position = context.position;
        element.style.padding = context.padding;
      }, result.bounds.paintContext);
    if (result.bounds) {
      const camera = cameraNodeId
        ? await page.locator(`[data-open-pencil-node-id="${cameraNodeId}"]`).evaluate(
            (element, placement) => {
              const { nominal, nativeNodeId } = placement;
              Object.assign(element.style, {
                overflow: "visible",
                contain: "none",
                transform: "none",
                transformOrigin: "0 0",
              });
              const native = element.querySelector(`[data-open-pencil-node-id="${nativeNodeId}"]`);
              if (!native) throw new Error("Native camera has no subject");
              const layout = native.getBoundingClientRect(),
                residual = { x: nominal.x - layout.x, y: nominal.y - layout.y };
              // Place the camera through layout first. An unnecessary ancestor
              // transform changes text and SVG rasterization even when the final
              // subject bounds agree. Reserve a transform for sub-layout precision.
              const cameraStyle = getComputedStyle(element);
              if (residual.x || residual.y) {
                if (cameraStyle.position === "static") element.style.position = "relative";
                element.style.left = `${(Number.parseFloat(cameraStyle.left) || 0) + residual.x}px`;
                element.style.top = `${(Number.parseFloat(cameraStyle.top) || 0) + residual.y}px`;
              }
              const placed = native.getBoundingClientRect(),
                remainder = { x: nominal.x - placed.x, y: nominal.y - placed.y };
              if (remainder.x || remainder.y) element.style.transform = `translate(${remainder.x}px, ${remainder.y}px)`;
              return {
                requestedOrigin: { x: nominal.x, y: nominal.y },
                layoutOrigin: { x: layout.x, y: layout.y },
                layoutTranslation: { x: placed.x - layout.x, y: placed.y - layout.y },
                residualTranslation: remainder,
                viewport: element.getBoundingClientRect().toJSON(),
                beforeExport: true,
              };
            },
            { nominal: result.bounds.nominal, nativeNodeId },
          )
        : await legacyCamera(page, result);
      result.nativeDocumentEnvironment = await preserveDocumentEnvironment(
        page,
        nativeNodeId,
        result.documentEnvironment,
      );
      result.nativeCameraBackings = await preserveCameraBackings(page, nativeNodeId, cameraContexts);
      result.nativeLayoutInitialization = await initializeNativeLayout(page, nativeNodeId);
      result.nativeSubjectEnvironment = await subjectEnvironment(page, nativeNodeId, result.subjectEnvironment);
      if (result.nativeSubjectEnvironment) await ready(page);
      const native = await bounds(page.locator(`[data-open-pencil-node-id="${nativeNodeId}"]`));
      if (!native) throw new Error("Native component has no rendered bounds");
      Object.assign(result.bounds, {
        native,
        declared: sourceGeometry,
        nativePhase: captureGeometry(native, padding).phase,
        camera,
      });
      if (!nativeGeometryMatches(result.bounds.nominal, native, sourceGeometry))
        throw new Error(`Component geometry differs: ${JSON.stringify(result.bounds)}`);
    }
    result.nativeInteractions = [];
    for (const action of nativeInteractions) {
      for (const saved of job.composites ?? [])
        if (saved.overlay?.triggerNodeId === action.nodeId) {
          const overlay = page.locator(`[data-open-pencil-overlay="${saved.overlay.destinationId}"]`);
          if (
            (await overlay.count()) !== 1 ||
            (await overlay.evaluate((node) => node.matches(":modal, :popover-open")))
          )
            throw Error("Covered popup must be closed before its saved trigger is activated");
        }
      if (action.type !== "click") throw new Error(`Unsupported native interaction: ${action.type}`);
      const trigger = page.locator(`[data-open-pencil-node-id="${action.nodeId}"]`);
      if ((await trigger.count()) !== 1) throw new Error("Native interaction trigger must match one rendered element");
      const activation = await clickVisibleTrigger(page, trigger);
      result.nativeInteractions.push({ ...action, activation });
    }
    result.nativeAnimationClock = await setNativeAnimationTime(page, nativeAnimationTime(target));
    if (nativeInteractions.length && result.bounds) {
      const after = await bounds(page.locator(`[data-open-pencil-node-id="${nativeNodeId}"]`));
      if (!after || !nativeGeometryMatches(result.bounds.nominal, after, sourceGeometry))
        throw new Error(`Native interaction changed component geometry: ${JSON.stringify(after)}`);
    }
    if (nativeScroll) {
      const node = page.locator(`[data-open-pencil-node-id="${nativeScroll.nodeId}"]`);
      if ((await node.count()) !== 1) throw new Error("Native scroll target must match one rendered element");
      const observed = await node.evaluate((element, requested) => {
        const contents = element.querySelectorAll(":scope > [data-open-pencil-scroll-content]");
        if (contents.length > 1) throw new Error("Native scroll target has multiple content viewports");
        const scroller = contents[0] ?? element;
        scroller.scrollTop = requested.top;
        scroller.scrollLeft = requested.left;
        return {
          contentViewport: scroller !== element,
          top: scroller.scrollTop,
          left: scroller.scrollLeft,
          scrollHeight: scroller.scrollHeight,
          scrollWidth: scroller.scrollWidth,
          clientHeight: scroller.clientHeight,
          clientWidth: scroller.clientWidth,
        };
      }, nativeScroll);
      result.nativeScroll = { requested: nativeScroll, observed };
      if (observed.top !== nativeScroll.top || observed.left !== nativeScroll.left)
        throw new Error(`Native scroll was clamped: ${JSON.stringify(result.nativeScroll)}`);
      await ready(page);
    }
    if (result.errors.length) throw new Error(result.errors.join("\n"));
    result.nativeAnimationPreparation = await prepareCapture(
      page,
      target.capture?.background,
      target.capture?.animations,
    );
    if (result.bounds)
      result.nativeStateInitialization = await initializeComponentLayout(
        page,
        `[data-open-pencil-node-id="${nativeNodeId}"]`,
        result.subjectEnvironment?.platformControl,
      );
    result.nativePaintInitialization = await initializePaint(
      page,
      `[data-open-pencil-node-id="${nativeNodeId}"]`,
      cameraContexts,
      undefined,
      [],
      job.composites,
    );
    const compositeClock = job.composites?.length
      ? await observeNativeAnimationTime(page, nativeAnimationTime(target))
      : undefined;
    const nativeComposites = job.composites?.length
      ? await observeNativeComposites(
          page,
          job.composites,
          compositeClock,
          result.nativePaintInitialization.nativeCaretLayers,
          result.nativeInteractions,
        )
      : [];
    for (const [index, saved] of (job.composites ?? []).entries()) {
      const proof = result.composites?.[index];
      if (!proof) throw new Error("Missing enclosing source observation for covered component");
      Object.assign(proof, { mainId: saved.mainId, nodeId: saved.nodeId, native: { before: nativeComposites[index] } });
    }

    result.nativeAnimationCapture = await screenshot(
      page,
      join(directory, `${name}.figma.png`),
      result.bounds?.capture,
      target.capture?.background,
      target.capture?.animations,
      captureCaret(target),
    );
    if (job.composites?.length) {
      const animation = await observeNativeAnimationTime(page, nativeAnimationTime(target));
      const after = await observeNativeComposites(
        page,
        job.composites,
        animation,
        result.nativePaintInitialization.nativeCaretLayers,
        result.nativeInteractions,
      );
      for (const [index, proof] of result.composites.entries()) {
        proof.native.after = after[index];
        if (JSON.stringify(proof.native.before) !== JSON.stringify(proof.native.after))
          throw new Error("Covered native instance or clock changed during capture");
      }
    }
  } catch (error) {
    result.error = error.message;
    result.fonts = await fontDiagnostics(page);
  } finally {
    await page.close();
  }
  return result;
}

try {
  const captured =
    mode === "reference" ? JSON.parse(await readFile(join(directory, "actual.json"), "utf8")) : undefined;
  const groups = new Map();
  for (const job of jobs) {
    const launch = designBrowserCapture(job.target);
    const key = JSON.stringify(launch);
    if (!groups.has(key)) groups.set(key, { launch, jobs: [] });
    groups.get(key).jobs.push(job);
  }
  for (const group of groups.values()) {
    browser = await chromium.launch(group.launch);
    try {
      const version = browser.version();
      if (!version.startsWith("153.")) throw new Error(`Expected fixed Chromium 153; got ${version}`);
      if ((report.browser && report.browser !== version) || (captured && captured.browser !== version))
        throw new Error("Capture phases and browser contexts must use the same browser version");
      report.browser = version;
      const displayPage = await browser.newPage({
        viewport: DESIGN_BROWSER_SCREEN,
        screen: DESIGN_BROWSER_SCREEN,
        deviceScaleFactor: 1,
      });
      let context;
      try {
        const client = await displayPage.context().newCDPSession(displayPage);
        const screens = await client.send("Emulation.getScreenInfos");
        context = { launch: group.launch, physicalScreen: assertDesignBrowserScreen(screens) };
        report.screenInfos ??= { ...screens, browserContexts: [] };
        report.screenInfos.browserContexts.push({ launch: group.launch, ...screens });
        report.environment.physicalScreen ??= context.physicalScreen;
        report.environment.browserContexts.push(context);
        await client.detach();
      } finally {
        await displayPage.close();
      }
      const environment = { browser: version, screen: DESIGN_BROWSER_SCREEN, ...context };
      for (const job of group.jobs) {
        const result = captured
          ? captured.targets.find((target) => target.id === job.target.id)
          : await captureImplementation(job);
        if (!result) throw new Error(`Missing implementation capture: ${job.target.id}`);
        if (captured && JSON.stringify(result.captureEnvironment) !== JSON.stringify(environment))
          throw new Error(`Capture phases must use the same declared browser conditions: ${job.target.id}`);
        result.captureEnvironment = environment;
        report.targets.push(mode === "actual" ? result : await captureReference(job, result));
      }
    } finally {
      await browser.close();
      browser = undefined;
    }
  }
  if (captured && JSON.stringify(captured.environment) !== JSON.stringify(report.environment))
    throw new Error("Capture phases must use the same browser conditions");
  const order = new Map(jobs.map((job, index) => [job.target.id, index]));
  report.targets.sort((a, b) => order.get(a.id) - order.get(b.id));
} finally {
  await writeFile(join(directory, mode === "actual" ? "actual.json" : "browser.json"), JSON.stringify(report));
  await browser?.close();
  await new Promise((complete) => server.close(complete));
}

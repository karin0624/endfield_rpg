import type { Page } from "@playwright/test";
import { expect, test } from "../browser/coverage";
import { observeWebGLResources, webGLResources } from "../browser/webglResources";
import type { RendererView } from "../fixtures/renderer-view";

const entry = "http://127.0.0.1:4174/rpg/tests/fixtures/renderer-view.html";
async function create(page: Page) {
  await page.goto(entry);
  await page.evaluate(() => (window as typeof window & { rendererView: RendererView }).rendererView.create());
}
async function start(
  page: Page,
  count: "full" | "small" = "full",
  environment: "known" | "unknown" | "alternate" = "known",
) {
  await page.evaluate(
    ([count, environment]) =>
      (window as typeof window & { rendererView: RendererView }).rendererView.start(count, environment),
    [count, environment] as const,
  );
}
async function ready(page: Page) {
  await page.evaluate(() => (window as typeof window & { rendererView: RendererView }).rendererView.ready());
}
async function dispose(page: Page) {
  await page.evaluate(() => (window as typeof window & { rendererView: RendererView }).rendererView.dispose());
  await expect.poll(() => webGLResources(page)).toEqual({ Buffer: 0, Texture: 0, Program: 0 });
}

test("実RGBD shaderの準備中に退出しても、遅着したGPU準備を完了して全資源を解放する", async ({ page }) => {
  await observeWebGLResources(page);
  let shaderUrl = "";
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  // Hold the real shader module used by Babylon's scene-owned BRDF decode, not a second texture fetch.
  await page.route("**/rgbdDecode.fragment-*.js", async (route) => {
    shaderUrl = route.request().url();
    const response = await route.fetch();
    await held;
    await route.fulfill({ response });
  });
  await create(page);
  await start(page);
  await expect.poll(() => shaderUrl).not.toBe("");
  const programsBeforeClose = await page.evaluate(() => performance.getEntriesByName("webgl-create-Program").length);
  await page.evaluate(() => (window as typeof window & { rendererView: RendererView }).rendererView.dispose());
  release();
  await page.evaluate(async (url) => {
    await import(url);
  }, shaderUrl);
  // Observe an actual late allocation before asserting cleanup; an earlier zero is not completion evidence.
  await expect
    .poll(() => page.evaluate(() => performance.getEntriesByName("webgl-create-Program").length))
    .toBeGreaterThan(programsBeforeClose);
  await expect.poll(() => webGLResources(page)).toEqual({ Buffer: 0, Texture: 0, Program: 0 });
});

test("実rendererの同環境切替はwarm資源を増やさず、実素材を一度だけ取得して退出で解放する", async ({ page }) => {
  await page.addInitScript(() => {
    const pending = new Set<number>();
    const request = window.requestAnimationFrame.bind(window);
    const cancel = window.cancelAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) => {
      const id = request((time) => {
        pending.delete(id);
        callback(time);
      });
      pending.add(id);
      return id;
    };
    window.cancelAnimationFrame = (id) => {
      pending.delete(id);
      cancel(id);
    };
    Object.defineProperty(window, "pendingFrameCount", { get: () => pending.size });
  });
  const errors: string[] = [],
    urls: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.includes("/assets/")) urls.push(request.url());
  });
  await observeWebGLResources(page);
  await create(page);
  await start(page);
  await ready(page);
  await page.evaluate(() =>
    (window as typeof window & { rendererView: RendererView }).rendererView.paint([
      { id: "slime-2", visible: true, opacity: 0.5, emissive: [1, 0.6, 0.6] },
    ]),
  );
  await start(page, "small");
  await ready(page);
  await page.screenshot();
  const warmSmall = await webGLResources(page);
  const before = await page.evaluate(
    () => (window as typeof window & { rendererView: RendererView }).rendererView.measure().rect,
  );
  await page.evaluate(() =>
    (window as typeof window & { rendererView: RendererView }).rendererView.applyToReleasedScene(),
  );
  expect(
    await page.evaluate(() => (window as typeof window & { rendererView: RendererView }).rendererView.measure().rect),
  ).toEqual(before);
  await start(page);
  await ready(page);
  // Native capture finishes real WebGL paint before counting allocations, not a visual assertion.
  await page.screenshot();
  const warm = await webGLResources(page);
  for (const kind of ["Buffer", "Texture", "Program"]) expect(warm[kind]).toBeGreaterThan(0);
  // Observe both states after their first allocation, then verify a complete warm round trip.
  // Extra identical repetitions add no distinct asset, owner or transition boundary.
  await start(page, "small");
  await ready(page);
  await page.screenshot();
  expect(await webGLResources(page)).toEqual(warmSmall);
  await start(page);
  await ready(page);
  await page.screenshot();
  expect(await webGLResources(page)).toEqual(warm);
  expect(urls.filter((url) => url.endsWith("ground1.glb"))).toHaveLength(1);
  expect(urls.some((url) => url.endsWith("front-left.png"))).toBe(true);
  for (const url of urls) expect(new URL(url).pathname).toMatch(/^\/rpg\/assets\//);
  expect(await page.evaluate(() => Reflect.get(window, "pendingFrameCount"))).toBeGreaterThan(0);
  await dispose(page);
  expect(await page.evaluate(() => Reflect.get(window, "pendingFrameCount"))).toBe(0);
  await page.setViewportSize({ width: 700, height: 800 });
  expect(await webGLResources(page)).toEqual({ Buffer: 0, Texture: 0, Program: 0 });
  expect(errors).toEqual([]);
});

test("保留した旧立ち絵を待たずに現在sceneを用意し、実transport終端と遅着load後の資源を解放する", async ({ page }) => {
  await page.addInitScript(() => {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
    if (!descriptor?.set) throw new Error("画像読込の観測を開始できません");
    Object.defineProperty(HTMLImageElement.prototype, "src", {
      ...descriptor,
      set(this: HTMLImageElement, value: string) {
        if (value.includes("gilberta/front-left.png")) {
          const completed = () => performance.mark("late-portrait-completed");
          this.addEventListener("load", completed, { once: true });
          this.addEventListener("error", completed, { once: true });
        }
        descriptor.set?.call(this, value);
      },
    });
  });
  let portraitTerminal: "finished" | "failed" | undefined;
  page.on("requestfinished", (request) => {
    if (request.url().includes("gilberta/front-left.png")) portraitTerminal = "finished";
  });
  page.on("requestfailed", (request) => {
    if (request.url().includes("gilberta/front-left.png")) portraitTerminal = "failed";
  });
  const held = new Map<string, () => void>();
  await page.route("**/assets/**", async (route) => {
    const url = route.request().url();
    const key = url.endsWith("ground1.glb")
      ? "ground"
      : url.endsWith("landscape1.png")
        ? "background"
        : url.includes("gilberta/front-left.png")
          ? "portrait"
          : undefined;
    if (key) await new Promise<void>((resolve) => held.set(key, resolve));
    try {
      await route.continue();
    } catch {
      /* A released renderer can abort its transport. */
    }
  });
  await observeWebGLResources(page);
  await create(page);
  await start(page);
  await expect.poll(() => held.size).toBe(3);
  await start(page, "small");
  held.get("ground")?.();
  held.get("background")?.();
  await ready(page);
  await start(page);
  await start(page, "small", "alternate");
  await ready(page);
  await page.evaluate(() => (window as typeof window & { rendererView: RendererView }).rendererView.dispose());
  held.get("portrait")?.();
  await expect.poll(() => portraitTerminal, { timeout: 60_000 }).toBeDefined();
  if (portraitTerminal === "finished") {
    // An aborted transport has no required image load; a completed transport must reach its real decoder callback.
    await expect
      .poll(() => page.evaluate(() => performance.getEntriesByName("late-portrait-completed").length), {
        timeout: 60_000,
      })
      .toBeGreaterThan(0);
  }
  await expect.poll(() => webGLResources(page), { timeout: 60_000 }).toEqual({ Buffer: 0, Texture: 0, Program: 0 });
});

test("旧環境のGLBと背景を待たずに別環境を生成し、実遅着decode後も資源を保持しない", async ({ page }) => {
  // This barrier observes the actual image completion after Babylon's listeners, not just HTTP completion.
  await page.addInitScript(() => {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
    if (!descriptor?.set) throw new Error("画像読込の観測を開始できません");
    Object.defineProperty(HTMLImageElement.prototype, "src", {
      ...descriptor,
      set(this: HTMLImageElement, value: string) {
        if (value.endsWith("/landscape1.png"))
          this.addEventListener("load", () => performance.mark("late-background-loaded"), { once: true });
        descriptor.set?.call(this, value);
      },
    });
  });
  const held: Array<() => void> = [];
  await page.route("**/assets/**", async (route) => {
    const url = route.request().url();
    if (url.endsWith("ground1.glb") || url.endsWith("landscape1.png"))
      await new Promise<void>((resolve) => held.push(resolve));
    try {
      await route.continue();
    } catch {
      /* Native cancellation can end the old request. */
    }
  });
  await observeWebGLResources(page);
  await create(page);
  await start(page);
  await expect.poll(() => held.length).toBe(2);
  await start(page, "small", "alternate");
  await ready(page);
  expect(
    await page.evaluate(
      () => (window as typeof window & { rendererView: RendererView }).rendererView.measure().completedLoads,
    ),
  ).toBe(1);
  await page.screenshot();
  const warm = await webGLResources(page);
  const done = ["landscape1.png", "ground1.glb"].map((asset) =>
    page.waitForResponse((response) => response.url().endsWith(asset)).then((response) => response.finished()),
  );
  for (const release of held) release();
  await Promise.all(done);
  await expect
    .poll(() => page.evaluate(() => performance.getEntriesByName("late-background-loaded").length), { timeout: 60_000 })
    .toBe(1);
  await start(page, "small", "alternate");
  await ready(page);
  await page.screenshot();
  expect(await webGLResources(page)).toEqual(warm);
  expect(
    await page.evaluate(
      () => (window as typeof window & { rendererView: RendererView }).rendererView.measure().completedLoads,
    ),
  ).toBe(1);
  await dispose(page);
});

for (const [deviceScaleFactor, renderScale] of [
  [1, 1],
  [3, 1.5],
] as const) {
  test.describe(() => {
    test.use({ viewport: { width: 800, height: 900 }, deviceScaleFactor });
    test(`DPR${deviceScaleFactor}で実canvasの倍率${renderScale}を保ちリサイズ後も解放する`, async ({ page }) => {
      await observeWebGLResources(page);
      await create(page);
      await start(page);
      await ready(page);
      for (const width of [800, 640]) {
        await page.setViewportSize({ width, height: 900 });
        await expect
          .poll(() =>
            page
              .locator("canvas")
              .evaluate((canvas: HTMLCanvasElement) => ({ width: canvas.width, height: canvas.height })),
          )
          .toEqual({ width: width * renderScale, height: ((width * 9) / 16) * renderScale });
      }
      await dispose(page);
    });
  });
}

for (const failure of ["model-404", "model-invalid", "background-404"] as const) {
  test(`実素材の${failure}でreadyが拒否され、破棄後のGPU資源は0になる`, async ({ page }) => {
    await observeWebGLResources(page);
    await page.route(
      failure === "background-404" ? "**/assets/backgrounds/landscape1.png" : "**/assets/ground/ground1.glb",
      (route) => route.fulfill({ status: failure === "model-invalid" ? 200 : 404, body: "invalid asset" }),
    );
    await create(page);
    await start(page);
    const result = await page.evaluate(() => {
      const pending = (window as typeof window & { rendererView: RendererView }).rendererView.ready();
      return pending.then(
        () => ({ status: "fulfilled", reason: "" }),
        (error: unknown) => ({ status: "rejected", reason: String(error) }),
      );
    });
    expect(result.status).toBe("rejected");
    if (failure === "model-404") expect(result.reason).toContain("モデルを読み込めません: ground/ground1.glb (404)");
    if (failure === "background-404")
      expect(result.reason).toContain("画像を読み込めません: backgrounds/landscape1.png");
    await dispose(page);
  });
}

test("背景失敗と保留GLBの実load完了後、失敗sceneの全資源を解放する", async ({ page }) => {
  await observeWebGLResources(page);
  let release = () => {},
    requested = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const seen = new Promise<void>((resolve) => {
    requested = resolve;
  });
  await page.route("**/assets/ground/ground1.glb", async (route) => {
    requested();
    await held;
    await route.continue();
  });
  await page.route("**/assets/backgrounds/landscape1.png", (route) =>
    route.fulfill({ status: 404, body: "missing background" }),
  );
  await create(page);
  const failed = page.waitForResponse(
    (response) => response.url().endsWith("/landscape1.png") && response.status() === 404,
  );
  await start(page);
  await seen;
  await failed;
  release();
  const result = await page.evaluate(() => {
    const pending = (window as typeof window & { rendererView: RendererView }).rendererView.ready();
    return pending.then(
      () => ({ status: "fulfilled", reason: "" }),
      (error: unknown) => ({ status: "rejected", reason: String(error) }),
    );
  });
  expect(result.status).toBe("rejected");
  expect(result.reason).toContain("画像を読み込めません: backgrounds/landscape1.png");
  expect(
    await page.evaluate(
      () => (window as typeof window & { rendererView: RendererView }).rendererView.measure().completedLoads,
    ),
  ).toBe(1);
  await dispose(page);
});

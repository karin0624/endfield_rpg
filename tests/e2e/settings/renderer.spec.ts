import { collectCoverage, expect, test } from "../coverage";
import { observeWebGLResources, webGLResources } from "../webglResources";

test("同じ環境の次戦は旧表示・演出を引き継がず、資源を増やさず切替と解放を行う", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let groundRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes("ground1.glb")) groundRequests += 1;
  });
  await observeWebGLResources(page);
  await page.goto("/tests/fixtures/battle-lifecycle.html");
  const status = page.getByRole("status", { name: "表示状態" });
  const left = page.getByLabel("敵画像の左端");
  const late = page.getByLabel("古い演出の完了回数");
  await page.getByRole("button", { name: "2対2を表示", exact: true }).click();
  await expect(status).toHaveText("4人の表示完了", { timeout: 60_000 });
  await expect(page.locator(".enemy-world-label")).toHaveCount(2);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.getByRole("button", { name: "攻撃直後に切替" }).click();
  await expect(status).toHaveText("2人の表示完了", { timeout: 60_000 });
  await expect(page.getByRole("button", { name: /スライム B、HP 14\/14/ })).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "撃破中に切替" }).click();
  await expect(status).toHaveText("2人の表示完了", { timeout: 60_000 });
  await expect(page.getByRole("button", { name: /スライム B、HP 14\/14/ })).toBeVisible();
  const initialLeft = await left.textContent();
  await page.getByRole("button", { name: "旧表示に操作" }).click();
  await expect(left).toHaveText(initialLeft ?? "");
  await expect(late).toHaveText("0");
  await page.getByRole("button", { name: "敵位置を変更" }).click();
  await expect(left).not.toHaveText(initialLeft ?? "");

  await page.getByRole("button", { name: "2対2を表示", exact: true }).click();
  await expect(status).toHaveText("4人の表示完了", { timeout: 60_000 });
  await page.screenshot();
  const warm = await webGLResources(page);
  expect(warm.Buffer).toBeGreaterThan(0);
  expect(warm.Texture).toBeGreaterThan(0);
  expect(warm.Program).toBeGreaterThan(0);
  for (let iteration = 0; iteration < 3; iteration++) {
    await page.getByRole("button", { name: "1対1を表示", exact: true }).click();
    await expect(status).toHaveText("2人の表示完了", { timeout: 60_000 });
    await page.getByRole("button", { name: "2対2を表示", exact: true }).click();
    await expect(status).toHaveText("4人の表示完了", { timeout: 60_000 });
    await expect(page.locator(".enemy-world-label")).toHaveCount(2);
    await page.screenshot();
    expect(await webGLResources(page)).toEqual(warm);
  }
  expect(groundRequests).toBe(1);
  await page.getByRole("button", { name: "描画を破棄" }).click();
  await expect(status).toHaveText("破棄済み");
  await expect.poll(() => webGLResources(page)).toEqual({ Buffer: 0, Texture: 0, Program: 0 });
  await expect(page.getByRole("button", { name: "通常攻撃" })).toHaveCount(0);
  await expect(page.locator(".enemy-world-label")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("旧立ち絵の読込を保留したまま次の表示と退出が完了する", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
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
    if (key !== undefined) await new Promise<void>((resolve) => held.set(key, resolve));
    try {
      await route.continue();
    } catch {
      /* The owner may have aborted this request. */
    }
  });
  await observeWebGLResources(page);
  await page.goto("/tests/fixtures/battle-lifecycle.html");
  const status = page.getByRole("status", { name: "表示状態" });
  await page.getByRole("button", { name: "2対2を表示", exact: true }).click();
  await expect.poll(() => held.size).toBe(3);
  await page.getByRole("button", { name: "1対1を表示", exact: true }).click();
  held.get("ground")?.();
  held.get("background")?.();
  await expect(status).toHaveText("2人の表示完了", { timeout: 60_000 });
  // The discarded battle's unique portrait is still held here.
  await page.getByRole("button", { name: "2対2を表示", exact: true }).click();
  await expect(status).toHaveText("読込中");
  await page.getByRole("button", { name: "別の環境を表示" }).click();
  await expect(status).toHaveText("2人の表示完了", { timeout: 60_000 });
  await expect(page.getByRole("button", { name: /スライム B、HP 14\/14/ })).toBeVisible();
  await page.getByRole("button", { name: "描画を破棄" }).click();
  held.get("portrait")?.();
  await expect(status).toHaveText("破棄済み");
  await expect.poll(() => webGLResources(page), { timeout: 60_000 }).toEqual({ Buffer: 0, Texture: 0, Program: 0 });
  expect(errors).toEqual([]);
});

test("旧環境のモデル・背景を待たずに別環境を表示し、遅着した素材も解放する", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // Observe the browser's image completion, after Babylon's existing load
  // listeners. HTTP completion alone does not wait for image decoding.
  await page.addInitScript(() => {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
    if (!descriptor?.set) throw new Error("画像読込の観測を開始できません");
    Object.defineProperty(HTMLImageElement.prototype, "src", {
      ...descriptor,
      set(this: HTMLImageElement, value: string) {
        if (value.endsWith("/landscape1.png")) {
          this.addEventListener("load", () => performance.mark("late-background-loaded"), { once: true });
        }
        descriptor.set?.call(this, value);
      },
    });
  });
  const held: Array<() => void> = [];
  await page.route("**/assets/**", async (route) => {
    const url = route.request().url();
    if (url.endsWith("ground1.glb") || url.endsWith("landscape1.png")) {
      await new Promise<void>((resolve) => held.push(resolve));
    }
    try {
      await route.continue();
    } catch {
      /* Disposing the renderer may abort the transport. */
    }
  });
  await observeWebGLResources(page);
  await page.goto("/tests/fixtures/battle-lifecycle.html");
  const status = page.getByRole("status", { name: "表示状態" });
  await page.getByRole("button", { name: "2対2を表示", exact: true }).click();
  await expect.poll(() => held.length).toBe(2);
  await page.getByRole("button", { name: "別の環境を表示" }).click();
  await expect(status).toHaveText("2人の表示完了", { timeout: 60_000 });
  await expect(page.getByLabel("環境読込の完了回数")).toHaveText("1");
  await page.screenshot();
  const warm = await webGLResources(page);
  const backgroundFinished = page
    .waitForResponse((response) => response.url().endsWith("landscape1.png"))
    .then((response) => response.finished());
  const groundFinished = page
    .waitForResponse((response) => response.url().endsWith("ground1.glb"))
    .then((response) => response.finished());
  for (const release of held) release();
  await Promise.all([backgroundFinished, groundFinished]);
  await expect
    .poll(() => page.evaluate(() => performance.getEntriesByName("late-background-loaded").length), {
      timeout: 60_000,
    })
    .toBe(1);
  await page.getByRole("button", { name: "別の環境を表示" }).click();
  await expect(status).toHaveText("2人の表示完了", { timeout: 60_000 });
  await page.screenshot();
  await expect(page.getByLabel("環境読込の完了回数")).toHaveText("1");
  expect(await webGLResources(page)).toEqual(warm);
  await expect(page.getByRole("button", { name: /スライム B、HP 14\/14/ })).toBeVisible();
  await page.getByRole("button", { name: "描画を破棄" }).click();
  await expect(status).toHaveText("破棄済み");
  await expect.poll(() => webGLResources(page), { timeout: 60_000 }).toEqual({ Buffer: 0, Texture: 0, Program: 0 });
  expect(errors).toEqual([]);
});

for (const [deviceScaleFactor, renderScale] of [
  [1, 1],
  [3, 1.5],
]) {
  test.describe(() => {
    test.use({ viewport: { width: 800, height: 900 }, deviceScaleFactor });
    test(`端末DPR${deviceScaleFactor}でも描画倍率${renderScale}でリサイズし対象操作を保つ`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto("/?debug=1&battle=1");
      const attack = page.getByRole("button", { name: "通常攻撃", exact: true });
      await expect(attack).toBeEnabled({ timeout: 60_000 });
      for (const width of [800, 640]) {
        await page.setViewportSize({ width, height: 900 });
        // Native canvas allocation is the documented GPU workload cap, not a proxy for appearance.
        await expect
          .poll(
            () =>
              page.locator("canvas").evaluate((canvas: HTMLCanvasElement) => ({
                width: canvas.width,
                height: canvas.height,
              })),
            { timeout: 60_000 },
          )
          .toEqual({ width: width * renderScale, height: ((width * 9) / 16) * renderScale });
        await expect(page.locator(".stage")).toBeInViewport();
        const target = page.getByRole("button", { name: /スライム A、HP .*攻撃対象に選択/ });
        await target.click();
        await expect(target).toHaveAttribute("aria-pressed", "true");
        await expect(page.locator("[data-target-indicator]")).toBeInViewport();
      }
      await attack.click();
      await expect(page.locator('[data-enemy-label="slime"]')).toContainText("6 / 14");
      expect(errors).toEqual([]);
    });
  });
}

test("pagehideは履歴キャッシュ退避では操作と資源を維持し実退出では全資源を解放する", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await observeWebGLResources(page);
  await page.goto("/?debug=1&battle=1");
  const attack = page.getByRole("button", { name: "通常攻撃", exact: true });
  await expect(attack).toBeEnabled({ timeout: 60_000 });
  const allocated = await webGLResources(page);
  expect(allocated.Buffer).toBeGreaterThan(0);
  expect(allocated.Texture).toBeGreaterThan(0);
  expect(allocated.Program).toBeGreaterThan(0);
  // Browser lifecycle integration: exercise the actual entry listener, not the fixture's dispose button.
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true })));
  expect(await webGLResources(page)).toEqual(allocated);
  const target = page.getByRole("button", { name: /スライム A、HP .*攻撃対象に選択/ });
  await target.click();
  await attack.click();
  await expect(page.locator('[data-enemy-label="slime"]')).toContainText("6 / 14");
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: false })));
  await expect.poll(() => webGLResources(page)).toEqual({ Buffer: 0, Texture: 0, Program: 0 });
  await expect(attack).toHaveCount(0);
  await page.setViewportSize({ width: 640, height: 900 });
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: false })));
  expect(await webGLResources(page)).toEqual({ Buffer: 0, Texture: 0, Program: 0 });
  expect(errors).toEqual([]);
});

test("非rootのBASE_URLでビルドした配布物から実素材を取得して戦闘を表示・操作できる", async ({ page }) => {
  const { build, preview } = await import("vite");
  const { mkdtemp, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const outDir = await mkdtemp(join(tmpdir(), "nonroot-build-"));
  await build({
    configFile: false,
    mode: "debug",
    base: "/nested/rpg/",
    build: { outDir, ...(process.env.COVERAGE_BROWSER === "1" ? { sourcemap: "inline", minify: false } : {}) },
    logLevel: "error",
  });
  // A real Vite base setting exercises emitted asset URLs; rewriting HTTP requests would hide the bug.
  const server = await preview({
    root: process.cwd(),
    configFile: false,
    base: "/nested/rpg/",
    build: { outDir },
    preview: { host: "127.0.0.1", port: 0 },
    logLevel: "error",
  });
  const failures: string[] = [];
  const assets: string[] = [];
  page.on("pageerror", (error) => failures.push(error.message));
  page.on("requestfailed", (request) => failures.push(request.url()));
  page.on("response", (response) => {
    if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`);
  });
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.includes("/assets/")) assets.push(request.url());
  });
  try {
    const address = server.httpServer?.address();
    if (!address || typeof address === "string") throw new Error("検証用サーバーのポートがありません");
    const origin = `http://127.0.0.1:${address.port}`;
    await collectCoverage(page);
    await page.goto(`${origin}/nested/rpg/?debug=1&battle=1`);
    const attack = page.getByRole("button", { name: "通常攻撃", exact: true });
    await expect(attack).toBeEnabled({ timeout: 60_000 });
    await page.getByRole("button", { name: /スライム A、HP .*攻撃対象に選択/ }).click();
    await attack.click();
    await expect(page.locator('[data-enemy-label="slime"]')).toContainText("6 / 14");
    expect(assets.some((url) => new URL(url).pathname.endsWith(".glb"))).toBe(true);
    expect(assets.some((url) => new URL(url).pathname.endsWith(".png"))).toBe(true);
    for (const url of assets) {
      expect(new URL(url).origin).toBe(origin);
      expect(new URL(url).pathname).toMatch(/^\/nested\/rpg\/assets\//);
    }
    expect(failures).toEqual([]);
  } finally {
    await collectCoverage(page);
    await page.goto("about:blank").catch(() => {});
    await new Promise<void>((resolve, reject) =>
      server.httpServer.close((error) => (error ? reject(error) : resolve())),
    );
    await rm(outDir, { recursive: true, force: true });
  }
});

test("Vite HMRは旧戦闘の資源を解放して次の表示・操作を保つ", async ({ page }) => {
  const { cp, mkdtemp, mkdir, symlink, readFile, writeFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { createServer } = await import("vite");
  const project = process.cwd();
  const root = await mkdtemp(join(tmpdir(), "battle-hmr-"));
  let server: Awaited<ReturnType<typeof createServer>> | undefined;
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await cp(join(project, "src"), join(root, "src"), { recursive: true });
    await cp(join(project, "tests/fixtures/battle-hmr.html"), join(root, "index.html"));
    await mkdir(join(root, "public"));
    await symlink(join(project, "public/assets"), join(root, "public/assets"), "dir");
    await symlink(join(project, "node_modules"), join(root, "node_modules"), "dir");
    // Dependency discovery must see the finished project, rather than reload a page after late file creation.
    server = await createServer({
      root,
      cacheDir: join(root, ".vite"),
      configFile: false,
      server: { host: "127.0.0.1", port: 0, fs: { allow: [root, project] } },
      logLevel: "error",
    });
    await server.listen();
    const address = server.httpServer?.address();
    if (!address || typeof address === "string") throw new Error("HMRサーバーのポートがありません");
    await observeWebGLResources(page);
    await collectCoverage(page);
    await page.goto(`http://127.0.0.1:${address.port}/?battle=1`);
    const attack = page.getByRole("button", { name: "通常攻撃", exact: true });
    await expect(attack).toBeEnabled({ timeout: 60_000 });
    const warm = await webGLResources(page);
    expect(warm.Buffer).toBeGreaterThan(0);
    expect(warm.Texture).toBeGreaterThan(0);
    expect(warm.Program).toBeGreaterThan(0);
    // A native write triggers Vite HMR; identical source bytes keep coverage maps comparable.
    const entry = join(root, "src/web/debugMain.ts");
    await writeFile(entry, await readFile(entry));
    await expect(page.locator("body")).toHaveAttribute("data-hot-updated", "true", { timeout: 60_000 });
    await expect(attack).toBeEnabled({ timeout: 60_000 });
    await expect.poll(() => webGLResources(page)).toEqual(warm);
    await page.getByRole("button", { name: /スライム A、HP .*攻撃対象に選択/ }).click();
    await attack.click();
    await expect(page.locator('[data-enemy-label="slime"]')).toContainText("6 / 14");
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: false })));
    await expect.poll(() => webGLResources(page)).toEqual({ Buffer: 0, Texture: 0, Program: 0 });
    expect(errors).toEqual([]);
  } finally {
    await collectCoverage(page);
    await page.goto("about:blank").catch(() => {});
    await server?.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("通常起動のpagehideは履歴退避後の入力を保ち実退出後の入力を解放する", async ({ page }) => {
  await page.goto("/");
  const start = page.getByRole("button", { name: "新規開始", exact: true });
  await expect(start).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true })));
  await start.click();
  await page.getByRole("button", { name: "実行する", exact: true }).click();
  await expect(page.locator(".campaign-copy")).toHaveText("（仮テキスト）");
  const home = page.getByRole("button", { name: "ホームへ", exact: true });
  await expect(home).toBeEnabled();
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: false })));
  await home.click();
  await expect(page.locator(".campaign-copy")).toHaveText("（仮テキスト）");
  await expect(page.getByRole("button", { name: "探索先を選ぶ", exact: true })).toHaveCount(0);
});

for (const failure of ["model-404", "model-invalid", "background-404"] as const) {
  test(`素材失敗 ${failure} は画面に通知し操作を公開せず退出で資源を解放する`, async ({ page }) => {
    await observeWebGLResources(page);
    await page.route(
      failure === "background-404" ? "**/assets/backgrounds/landscape1.png" : "**/assets/ground/ground1.glb",
      (route) => route.fulfill({ status: failure === "model-invalid" ? 200 : 404, body: "invalid asset" }),
    );
    await page.goto("/tests/fixtures/battle-lifecycle.html");
    await page.locator("#full").click();
    await expect(page.getByLabel("表示状態")).toContainText("読込失敗", { timeout: 60_000 });
    await expect(page.getByRole("button", { name: "通常攻撃", exact: true })).toHaveCount(0);
    await page.locator("#dispose").click();
    await expect(page.getByLabel("表示状態")).toHaveText("破棄済み");
    await expect.poll(() => webGLResources(page)).toEqual({ Buffer: 0, Texture: 0, Program: 0 });
  });
}

test("背景の失敗は保留中のモデル読込を完了させてから通知し退出で全資源を解放する", async ({ page }) => {
  await observeWebGLResources(page);
  let release = () => {};
  let requested = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const groundRequested = new Promise<void>((resolve) => {
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
  await page.goto("/tests/fixtures/battle-lifecycle.html");
  const backgroundFailed = page.waitForResponse(
    (response) => response.url().endsWith("/assets/backgrounds/landscape1.png") && response.status() === 404,
  );
  await page.locator("#full").click();
  await groundRequested;
  await backgroundFailed;
  try {
    await expect(page.getByLabel("表示状態")).toHaveText("読込中");
    await expect(page.getByRole("button", { name: "通常攻撃", exact: true })).toHaveCount(0);
  } finally {
    release();
  }
  await expect(page.getByLabel("表示状態")).toContainText("読込失敗", { timeout: 60_000 });
  await expect(page.getByLabel("環境読込の完了回数")).toHaveText("1");
  await page.locator("#dispose").click();
  await expect(page.getByLabel("表示状態")).toHaveText("破棄済み");
  await expect.poll(() => webGLResources(page)).toEqual({ Buffer: 0, Texture: 0, Program: 0 });
});

test("素材準備中は操作を公開せず準備完了後に初めて攻撃できる", async ({ page }) => {
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/assets/ground/ground1.glb", async (route) => {
    await held;
    await route.continue();
  });
  await page.goto("/tests/fixtures/battle-lifecycle.html");
  await page.locator("#full").click();
  await expect(page.getByLabel("表示状態")).toHaveText("読込中");
  await expect(page.getByRole("button", { name: "通常攻撃", exact: true })).toHaveCount(0);
  release();
  await expect(page.getByLabel("表示状態")).toHaveText("4人の表示完了", { timeout: 60_000 });
  await expect(page.getByRole("button", { name: "通常攻撃", exact: true })).toBeEnabled();
});

test("通常mainのVite HMRは旧画面の入力を解除して新しい画面だけ操作する", async ({ page }) => {
  const { cp, mkdtemp, mkdir, symlink, readFile, writeFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { createServer } = await import("vite");
  const project = process.cwd();
  const root = await mkdtemp(join(tmpdir(), "battle-hmr-"));
  let server: Awaited<ReturnType<typeof createServer>> | undefined;
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await cp(join(project, "src"), join(root, "src"), { recursive: true });
    await writeFile(
      join(root, "index.html"),
      `<!doctype html><div id="app"></div><script type="module">
      import "/src/web/main.ts";
      import.meta.hot.accept("/src/web/main.ts", () => { document.body.dataset.hotUpdated = "true"; });
    </script>`,
    );
    await mkdir(join(root, "public"));
    await symlink(join(project, "public/assets"), join(root, "public/assets"), "dir");
    await symlink(join(project, "node_modules"), join(root, "node_modules"), "dir");
    // Dependency discovery must see the finished project, rather than reload a page after late file creation.
    server = await createServer({
      root,
      cacheDir: join(root, ".vite"),
      configFile: false,
      server: { host: "127.0.0.1", port: 0, fs: { allow: [root, project] } },
      logLevel: "error",
    });
    await server.listen();
    const address = server.httpServer?.address();
    if (!address || typeof address === "string") throw new Error("HMRサーバーのポートがありません");
    await collectCoverage(page);
    await page.goto(`http://127.0.0.1:${address.port}/`);
    const start = page.getByRole("button", { name: "新規開始", exact: true });
    await start.click();
    await page.getByRole("button", { name: "実行する", exact: true }).click();
    const oldHome = await page.getByRole("button", { name: "ホームへ", exact: true }).elementHandle();
    if (!oldHome) throw new Error("Missing previous input");
    // Exercise native file watching without introducing test-only application source.
    const entry = join(root, "src/web/main.ts");
    await writeFile(entry, await readFile(entry));
    await expect(page.locator("body")).toHaveAttribute("data-hot-updated", "true", { timeout: 60_000 });
    await expect(start).toBeVisible();
    await oldHome.evaluate((button: HTMLElement) => button.click());
    await expect(start).toBeVisible();
    await expect(page.getByRole("button", { name: "探索先を選ぶ", exact: true })).toHaveCount(0);
    await start.click();
    await page.getByRole("button", { name: "実行する", exact: true }).click();
    await page.getByRole("button", { name: "ホームへ", exact: true }).click();
    await expect(page.getByRole("button", { name: "探索先を選ぶ", exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await collectCoverage(page);
    await page.goto("about:blank").catch(() => {});
    await server?.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("退出は予約済みの描画フレームを取り消し後続フレームで表示を復活させない", async ({ page }) => {
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
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/tests/fixtures/battle-lifecycle.html");
  await page.locator("#full").click();
  await expect(page.getByLabel("表示状態")).toHaveText("4人の表示完了", { timeout: 60_000 });
  const frames = await page.evaluate(() => {
    const count = () => Reflect.get(window, "pendingFrameCount") as number;
    const before = count();
    document.querySelector<HTMLButtonElement>("#dispose")?.click();
    return { before, after: count() };
  });
  expect(frames.before).toBeGreaterThan(0);
  expect(frames.after).toBe(0);
  await page.setViewportSize({ width: 700, height: 800 });
  await expect(page.getByLabel("表示状態")).toHaveText("破棄済み");
  await expect(page.locator(".enemy-world-label")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "通常攻撃", exact: true })).toHaveCount(0);
});

for (const view of ["only-ground-scale", "only-formation-x", "only-formation-z", "only-backdrop", "only-camera"]) {
  test(`独立した構図 ${view} の接地・人物・影・背景を画像比較する`, async ({ page }) => {
    await page.goto(`/tests/fixtures/battle-lifecycle.html?view=${view}`);
    await page.locator("#full").click();
    await expect(page.getByLabel("表示状態")).toHaveText("4人の表示完了", { timeout: 60_000 });
    await expect(page.locator("canvas")).toHaveScreenshot(`independent-${view}.png`, {
      threshold: 0,
      maxDiffPixels: 0,
      stylePath: "tests/fixtures/ground-culling-screenshot.css",
    });
    await page.getByLabel("検証構図").selectOption("default");
    await page.locator("#apply-view").click();
    // The lifecycle fixture exposes renderer-only settings; remount its HUD for the new projection.
    await page.locator("#full").click();
    await expect(page.getByLabel("表示状態")).toHaveText("4人の表示完了", { timeout: 60_000 });
    await expect(page.locator("canvas")).toHaveScreenshot("independent-default.png", {
      threshold: 0,
      maxDiffPixels: 0,
      stylePath: "tests/fixtures/ground-culling-screenshot.css",
    });
  });
}

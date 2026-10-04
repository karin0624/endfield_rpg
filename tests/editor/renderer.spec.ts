import { collectCoverage, expect, test } from "../e2e/coverage";
import { observeWebGLResources, webGLResources } from "../e2e/webglResources";

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

test("単独設定の初期構図と既定へ戻す更新の接地・人物・影・背景を画像比較する", async ({ page }) => {
  await page.goto("/tests/fixtures/battle-lifecycle.html");
  for (const view of ["only-ground-scale", "only-formation-x", "only-formation-z", "only-backdrop", "only-camera"]) {
    // Each condition still constructs a fresh real renderer from its own settings.
    // Only the page, modules and HTTP cache are shared; constructor wiring is tested too.
    await page.getByLabel("検証構図").selectOption(view);
    await page.locator("#apply-view").click();
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
    await page.locator("#dispose").click();
    await expect(page.getByLabel("表示状態")).toHaveText("破棄済み");
  }
});

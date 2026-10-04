import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "vite";
import { collectCoverage, expect, test } from "../../browser/coverage";
import { observeWebGLResources, webGLResources } from "../../browser/webglResources";

test("実debug入口のHMRは旧WebGL資源を解放してfresh初期sceneを生成し、退出で全資源を解放する", async ({ page }) => {
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
    await page.goto(`http://127.0.0.1:${address.port}/?battle=1`);
    await expect(page.locator("canvas")).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
    await page.screenshot();
    const warm = await webGLResources(page);
    for (const kind of ["Buffer", "Texture", "Program"]) expect(warm[kind]).toBeGreaterThan(0);
    const entry = join(root, "src/web/debugMain.ts");
    await writeFile(entry, await readFile(entry));
    await expect(page.locator("body")).toHaveAttribute("data-hot-updated", "true", { timeout: 60_000 });
    await expect(page.locator("canvas")).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
    await page.screenshot();
    expect(await webGLResources(page)).toEqual(warm);
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: false })));
    await expect.poll(() => webGLResources(page)).toEqual({ Buffer: 0, Texture: 0, Program: 0 });
    expect(errors).toEqual([]);
  } finally {
    await collectCoverage(page);
    await page.goto("about:blank");
    await server?.close();
    await rm(root, { recursive: true, force: true });
  }
});

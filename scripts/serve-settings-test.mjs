import { cp, mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

// 保存操作の試験でユーザーの標準設定を上書きしないため、ソースだけを隔離する。
export async function serveSettingsTest(project = process.cwd(), port = 4174) {
  const root = await mkdtemp(join(tmpdir(), "endfield-settings-test-"));
  let server;
  async function close() {
    await server?.close();
    await rm(root, { recursive: true, force: true });
  }
  try {
    await cp(resolve(project, "src"), join(root, "src"), { recursive: true });
    await cp(resolve(project, "index.html"), join(root, "index.html"));
    await cp(resolve(project, "tests/fixtures"), join(root, "tests/fixtures"), { recursive: true });
    await mkdir(join(root, "public"));
    await symlink(resolve(project, "public/assets"), join(root, "public/assets"), "dir");
    await symlink(resolve(project, "node_modules"), join(root, "node_modules"), "dir");
    server = await createServer({
      root,
      configFile: resolve(project, "vite.config.ts"),
      cacheDir: join(root, ".vite"),
      server: { host: "127.0.0.1", port, strictPort: true, fs: { allow: [root, project] } },
    });
    await server.listen();
    return { root, server, close };
  } catch (error) {
    await close();
    throw error;
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const running = await serveSettingsTest();
  for (const signal of ["SIGINT", "SIGTERM"])
    process.once(signal, () => {
      void running.close().then(() => process.exit(0));
    });
  running.server.printUrls();
}

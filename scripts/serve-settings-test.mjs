import { cp, mkdtemp, mkdir, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { createServer } from "vite";

// 保存操作の試験でユーザーの標準設定を上書きしないため、ソースだけを隔離する。
const project = process.cwd();
const root = await mkdtemp(join(tmpdir(), "endfield-settings-test-"));
let server;
async function close() {
  await server?.close();
  await rm(root, { recursive: true, force: true });
}
try {
  await cp(resolve(project, "src"), join(root, "src"), { recursive: true });
  await cp(resolve(project, "index.html"), join(root, "index.html"));
  await mkdir(join(root, "public"));
  await symlink(resolve(project, "public/assets"), join(root, "public/assets"), "dir");
  await symlink(resolve(project, "node_modules"), join(root, "node_modules"), "dir");
  server = await createServer({
    root, configFile: resolve(project, "vite.config.ts"), cacheDir: join(root, ".vite"),
    server: { host: "127.0.0.1", port: 4174, strictPort: true, fs: { allow: [root, project] } },
  });
  for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => { void close().then(() => process.exit(0)); });
  await server.listen();
  server.printUrls();
} catch (error) {
  await close();
  throw error;
}

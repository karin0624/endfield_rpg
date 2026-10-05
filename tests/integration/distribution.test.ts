import { readdir, readFile } from "node:fs/promises";
import { preview } from "vite";
import { afterAll, beforeAll, expect, it } from "vitest";

let server: Awaited<ReturnType<typeof preview>>;
let origin: string;

// npm run check builds the current normal entry before Vitest. The same dist is used by direct title VRT.
beforeAll(async () => {
  server = await preview({ configFile: false, build: { outDir: "dist" }, preview: { host: "127.0.0.1", port: 0 } });
  const address = server.httpServer.address();
  if (!address || typeof address === "string") throw new Error("Missing distribution preview port");
  origin = `http://127.0.0.1:${address.port}`;
});
afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.httpServer.close((error) => (error ? reject(error) : resolve())));
});

it("通常配布の実HTTPは開発保存APIを公開せず、fixture/source URLにも通常entryを返す", async () => {
  for (const endpoint of ["battle-settings", "adventure-settings"]) {
    const response = await fetch(`${origin}/__dev/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"version":1}',
    });
    expect(response.ok).toBe(false);
  }
  const normal = await (await fetch(origin)).text();
  expect(normal).toBe(await readFile("dist/index.html", "utf8"));
  for (const path of ["/tests/fixtures/battle-view.html", "/src/web/debugMain.ts", "/?debug=1&edit=1"]) {
    expect(await (await fetch(origin + path)).text()).toBe(normal);
  }
});

it("通常配布の実ファイルには開発entry・fixture・保存APIの実装を含めない", async () => {
  const entries = await readdir("dist", { recursive: true });
  expect(entries.some((entry) => /(^|\/)(tests|src|scripts)(\/|$)/.test(entry))).toBe(false);
  const scripts = await Promise.all(
    entries.filter((entry) => entry.endsWith(".js")).map((entry) => readFile(`dist/${entry}`, "utf8")),
  );
  expect(scripts.length).toBeGreaterThan(0);
  for (const script of scripts) {
    expect(script).not.toMatch(
      /__dev\/(?:battle|adventure)-settings|data-battle-editor|data-adventure-editor|デバッグ保存|標準として保存/,
    );
  }
});

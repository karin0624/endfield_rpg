import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { createServer as createHttpServer, request } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "vite";
import { afterEach, describe, expect, it } from "vitest";
import { adventureSettingsPlugin } from "../../scripts/adventure-settings-plugin";
import { battleSettingsPlugin } from "../../scripts/battle-settings-plugin";

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});

async function serve(kind: "battle" | "adventure") {
  const root = await mkdtemp(join(tmpdir(), "settings-api-"));
  cleanup.push(() => rm(root, { recursive: true, force: true }));
  const file = join(root, "src/web", `${kind}-settings.json`);
  await mkdir(join(root, "src/web"), { recursive: true });
  const original = await readFile(`src/web/${kind}-settings.json`, "utf8");
  await writeFile(file, original);
  const vite = await createServer({
    root,
    configFile: false,
    logLevel: "silent",
    plugins: [kind === "battle" ? battleSettingsPlugin() : adventureSettingsPlugin()],
    server: { middlewareMode: true, watch: null },
  });
  cleanup.push(() => vite.close());
  const server = createHttpServer(vite.middlewares);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  cleanup.push(
    () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  );
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("HTTP address missing");
  const origin = `http://127.0.0.1:${address.port}`;
  const url = `${origin}/__dev/${kind}-settings`;
  const headers = { origin, "content-type": "application/json" };
  return { root, file, original, server, url, headers };
}

for (const kind of ["battle", "adventure"] as const) {
  describe(`${kind} settings HTTP contract`, () => {
    it("rejects method, foreign/missing origin, content type and malformed payload without replacing the saved file", async () => {
      const { file, original, url, headers } = await serve(kind);
      for (const [init, status] of [
        [{ method: "GET" }, 405],
        [{ method: "POST", headers: { ...headers, origin: "https://foreign.example" }, body: original }, 403],
        [{ method: "POST", headers: { "content-type": "application/json" }, body: original }, 403],
        [{ method: "POST", headers: { ...headers, "content-type": "text/plain" }, body: original }, 403],
        [{ method: "POST", headers, body: "{" }, 400],
        [{ method: "POST", headers, body: '{"version":999}' }, 400],
      ] as const) {
        const response = await fetch(url, init);
        expect(response.status).toBe(status);
        expect(response.headers.get("content-type")).toContain("application/json");
        expect(await readFile(file, "utf8")).toBe(original);
      }
    });
    it("accepts 4096 bytes, rejects 4097 UTF-8 bytes and unlocks subsequent saves", async () => {
      const { file, original, url, headers } = await serve(kind);
      const compact = JSON.stringify(JSON.parse(original));
      const exact = compact + " ".repeat(4096 - Buffer.byteLength(compact));
      expect((await fetch(url, { method: "POST", headers, body: exact })).status).toBe(200);
      const saved = await readFile(file, "utf8");
      expect(JSON.parse(saved)).toEqual(JSON.parse(original));
      const over = `${compact}${" ".repeat(4094 - Buffer.byteLength(compact))}あ`;
      expect((await fetch(url, { method: "POST", headers, body: over })).status).toBe(413);
      expect(await readFile(file, "utf8")).toBe(saved);
      expect((await fetch(url, { method: "POST", headers, body: original })).status).toBe(200);
    });
    it("reassembles a valid 4096-byte JSON when a UTF-8 character is split across received chunks", async () => {
      const { file, original, server, url, headers } = await serve(kind);
      const compact = JSON.stringify({ ...JSON.parse(original), note: "あ" });
      const body = Buffer.from(compact + " ".repeat(4096 - Buffer.byteLength(compact)));
      expect((await fetch(url, { method: "POST", headers, body })).status).toBe(200);
      const receivedFirstChunk = new Promise<void>((resolve) =>
        server.once("request", (incoming) => incoming.once("data", () => resolve())),
      );
      const streamed = request(url, { method: "POST", headers });
      const completed = new Promise<number | undefined>((resolve, reject) => {
        streamed.on("response", (response) => {
          response.resume();
          response.on("end", () => resolve(response.statusCode));
        });
        streamed.on("error", reject);
      });
      const split = body.indexOf(Buffer.from("あ")) + 1;
      streamed.write(body.subarray(0, split));
      try {
        await receivedFirstChunk;
      } finally {
        streamed.end(body.subarray(split));
      }
      expect(await completed).toBe(200);
      expect(JSON.parse(await readFile(file, "utf8"))).toEqual(JSON.parse(original));
    });
    it("rejects a concurrent save with 409 and retains the old file until the first request completes", async () => {
      const { file, original, server, url, headers } = await serve(kind);
      const receiving = new Promise<void>((resolve) =>
        server.once("request", (incoming) => incoming.once("data", () => resolve())),
      );
      const first = request(url, { method: "POST", headers });
      const completed = new Promise<number | undefined>((resolve, reject) => {
        first.on("response", (response) => {
          response.resume();
          response.on("end", () => resolve(response.statusCode));
        });
        first.on("error", reject);
      });
      first.write(original.slice(0, 1));
      await receiving;
      try {
        expect((await fetch(url, { method: "POST", headers, body: original })).status).toBe(409);
        expect(await readFile(file, "utf8")).toBe(original);
      } finally {
        first.end(original.slice(1));
      }
      expect(await completed).toBe(200);
      expect((await fetch(url, { method: "POST", headers, body: original })).status).toBe(200);
    });
    it("writes only the fixed settings file even with an extra path field, preserving other settings and assets", async () => {
      const { root, file, original, url, headers } = await serve(kind);
      const other = join(root, "src/web", `${kind === "battle" ? "adventure" : "battle"}-settings.json`);
      const asset = join(root, "public/assets/sentinel.png");
      await mkdir(join(root, "public/assets"), { recursive: true });
      await writeFile(asset, "sentinel asset bytes");
      await writeFile(other, "other settings bytes");
      const changed = { ...JSON.parse(original), [kind === "battle" ? "cameraY" : "leftX"]: 9 };
      const response = await fetch(`${url}?path=../../public/assets/sentinel.png`, {
        method: "POST",
        headers,
        body: JSON.stringify({ ...changed, path: asset }),
      });
      expect(response.status).toBe(200);
      expect(JSON.parse(await readFile(file, "utf8"))).toEqual(changed);
      expect(await readFile(asset, "utf8")).toBe("sentinel asset bytes");
      expect(await readFile(other, "utf8")).toBe("other settings bytes");
    });
    it("reports disk failure without replacing the old file and permits retry", async () => {
      const { root, file, original, url, headers } = await serve(kind);
      const directory = join(root, "src/web");
      const unavailable = join(root, "unavailable-settings");
      // Make the public destination unavailable, regardless of the writer's temporary filename or UID.
      await rename(directory, unavailable);
      try {
        await writeFile(directory, "temporarily unavailable settings directory");
        expect((await fetch(url, { method: "POST", headers, body: original })).status).toBe(500);
        expect(await readFile(join(unavailable, `${kind}-settings.json`), "utf8")).toBe(original);
      } finally {
        await rm(directory, { force: true });
        await rename(unavailable, directory);
      }
      expect(await readFile(file, "utf8")).toBe(original);
      expect((await fetch(url, { method: "POST", headers, body: original })).status).toBe(200);
    });
  });
}

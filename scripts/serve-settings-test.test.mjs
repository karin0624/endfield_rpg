import { access, cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, it } from "vitest";
import { serveSettingsTest } from "./serve-settings-test.mjs";

it("settings harness writes only its temporary source copy and removes it on shutdown", async () => {
  const project = await mkdtemp(join(tmpdir(), "settings-source-"));
  let running;
  try {
    await mkdir(join(project, "src/web"), { recursive: true });
    await mkdir(join(project, "tests/fixtures"), { recursive: true });
    await mkdir(join(project, "public/assets"), { recursive: true });
    await writeFile(join(project, "index.html"), "<!doctype html><p>isolated</p>");
    await cp("scripts", join(project, "scripts"), { recursive: true });
    await cp("vite.config.ts", join(project, "vite.config.ts"));
    await symlink(resolve("node_modules"), join(project, "node_modules"), "dir");
    for (const kind of ["battle", "adventure"]) {
      for (const suffix of ["Settings.ts", "-settings.json"]) {
        await cp(`src/web/${kind}${suffix}`, join(project, `src/web/${kind}${suffix}`));
      }
    }
    running = await serveSettingsTest(project, 0);
    const origin = running.server.resolvedUrls.local[0].replace(/\/$/, "");
    for (const kind of ["battle", "adventure"]) {
      const relative = `src/web/${kind}-settings.json`;
      const original = await readFile(join(project, relative), "utf8");
      const value = { ...JSON.parse(original), [kind === "battle" ? "cameraY" : "leftX"]: 9 };
      const response = await fetch(`${origin}/__dev/${kind}-settings`, {
        method: "POST",
        headers: { origin, "content-type": "application/json" },
        body: JSON.stringify(value),
      });
      expect(response.status).toBe(200);
      expect(JSON.parse(await readFile(join(running.root, relative), "utf8"))).toEqual(value);
      expect(await readFile(join(project, relative), "utf8")).toBe(original);
    }
    await running.close();
    await expect(access(running.root)).rejects.toThrow();
    // Caller-owned source and assets survive shutdown.
    await expect(access(join(project, "public/assets"))).resolves.toBeUndefined();
  } finally {
    await running?.close();
    await rm(project, { recursive: true, force: true });
  }
});

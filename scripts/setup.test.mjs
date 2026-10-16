import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { setup } from "./setup.mjs";

const materials = [
  { name: "public/assets/ground/ground1.glb", bytes: Buffer.from("ground fixture") },
  { name: "public/assets/ground/extra.glb", bytes: Buffer.from("another fixture") },
  { name: "art-src/source.blend", bytes: Buffer.from("source fixture") },
].map((asset) => ({
  ...asset,
  oid_type: "sha256",
  oid: createHash("sha256").update(asset.bytes).digest("hex"),
  size: asset.bytes.length,
}));
const key = "lfs.https://example.invalid/info/lfs.access";
const roots = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

async function fixture(options = {}) {
  const root = await mkdtemp(join(tmpdir(), "setup-contract-"));
  roots.push(root);
  for (const asset of materials) {
    const target = join(root, asset.name);
    mkdirSync(dirname(target), { recursive: true });
    const prepared = options.prepared === true || options.prepared?.includes(asset.name);
    writeFileSync(target, prepared ? asset.bytes : "version https://git-lfs.github.com/spec/v1\n");
  }
  const calls = [];
  function run(tool, args) {
    calls.push([tool, ...args]);
    const ok = (stdout = "") => ({ status: 0, stdout, stderr: "" });
    const fail = (stderr = "required stage failed") => ({ status: 2, stdout: "", stderr });
    if (options.fail?.(tool, args)) return fail();
    if (tool === "npm") return ok(args[0] === "--version" ? (options.npmVersion ?? "11.9.0") : "");
    if (args[0] === "worktree") return ok(`worktree ${root}\0HEAD test-ref\0\0`);
    if (args[0] === "rev-parse") return ok("test-ref");
    if (args[0] === "lfs" && args[1] === "ls-files")
      return ok(
        JSON.stringify({
          files:
            options.manifest ??
            materials.map(({ bytes: _bytes, ...asset }, index) => ({
              ...asset,
              ...(index === 0 ? options.pointer : {}),
            })),
        }),
      );
    if (args[1] === "fetch" && options.fetchError) return fail(options.fetchError);
    if (args[1] === "checkout")
      for (const path of args.slice(2)) {
        const asset = materials.find((asset) => asset.name === path);
        writeFileSync(join(root, path), options.corruptCheckout ? "corrupt" : asset.bytes);
      }
    return ok();
  }
  return { root, run, calls };
}

it("fetches only missing shipped assets at HEAD, verifies them and reuses prepared material", async () => {
  const env = await fixture({ prepared: [materials[0].name] });
  await setup(env);
  expect(env.calls).toContainEqual([
    "git",
    "lfs",
    "fetch",
    `--include=${materials[1].name}`,
    "--exclude=",
    "origin",
    "test-ref",
  ]);
  expect(env.calls).toContainEqual(["git", "lfs", "checkout", materials[1].name]);
  expect(env.calls.at(-1)).toEqual(["npm", "run", "check"]);
  expect(env.calls.filter((call) => call.join(" ") === "npm run check")).toHaveLength(1);
  expect(env.calls.some((call) => call.includes("build"))).toBe(false);
  env.calls.length = 0;
  await setup({ ...env, npmArgs: ["--cache", "/workspace/.npm"] });
  expect(env.calls).toContainEqual(["npm", "ci", "--cache", "/workspace/.npm"]);
  expect(env.calls.some((call) => call.includes("fetch") || call.includes("checkout"))).toBe(false);
  expect(env.calls.at(-1)).toEqual(["npm", "run", "check"]);
});

it("stops before checks when runtime, LFS install, dependencies, checkout or verification fail", async () => {
  for (const options of [
    { nodeVersion: "22.0.0" },
    { npmVersion: "10.0.0" },
    { fail: (_tool, args) => args.includes("install") },
    { fail: (tool, args) => tool === "npm" && args[0] === "ci" },
    { fail: (_tool, args) => args.includes("checkout") },
    { corruptCheckout: true },
    { pointer: { oid: "f".repeat(64) } },
    { pointer: { size: materials[0].size + 1 } },
    { pointer: { oid_type: "sha512" } },
    { pointer: { oid: "invalid" } },
    { manifest: [] },
  ]) {
    const env = await fixture(options);
    await expect(setup({ ...env, nodeVersion: options.nodeVersion ?? "24.19.0" })).rejects.toThrow();
    expect(env.calls).not.toContainEqual(["npm", "run", "check"]);
  }
});

it("stops after a failed download without repairing credentials, access settings or retrying", async () => {
  for (const fetchError of [
    "batch response: Maximum number of login attempts exceeded. Please try again later.",
    "batch response: unexpected status 403",
    "batch response: Git credentials not found",
    "batch response: repository access denied",
  ]) {
    const env = await fixture({ fetchError });
    await expect(setup(env)).rejects.toThrow("git lfs failed");
    expect(env.calls.filter((call) => call.includes("fetch"))).toHaveLength(1);
    expect(env.calls.some((call) => call.includes("config") || call.includes("setup-git"))).toBe(false);
    expect(env.calls.some((call) => call.includes("checkout"))).toBe(false);
    expect(env.calls).not.toContainEqual(["npm", "run", "check"]);
  }
});

it("propagates check failure", async () => {
  const env = await fixture({ prepared: true, fail: (tool, args) => tool === "npm" && args[0] === "run" });
  await expect(setup(env)).rejects.toThrow("npm run check failed");
});

it("preserves actual common and per-worktree configs from both main and linked checkouts", async () => {
  const root = await mkdtemp(join(tmpdir(), "setup-shared-contract-"));
  roots.push(root);
  const main = join(root, "main");
  const linked = join(root, "linked");
  mkdirSync(main);
  const git = (cwd, ...args) => {
    const result = spawnSync("git", args, { cwd, encoding: "utf8" });
    expect(result.status, result.stderr).toBe(0);
    return result.stdout;
  };
  git(main, "init");
  await writeFile(join(main, "marker"), "existing task");
  git(main, "add", "marker");
  git(main, "-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-m", "fixture");
  git(main, "config", "--local", key, "basic");
  git(main, "worktree", "add", "--detach", linked);
  for (const worktreeConfig of [false, true]) {
    if (worktreeConfig) {
      git(main, "config", "extensions.worktreeConfig", "true");
      git(main, "config", "--worktree", "test.task", "main task");
      git(linked, "config", "--worktree", key, "basic");
    }
    const files = [join(main, ".git/config")];
    if (worktreeConfig) {
      files.push(git(main, "rev-parse", "--path-format=absolute", "--git-path", "config.worktree").trim());
      files.push(git(linked, "rev-parse", "--path-format=absolute", "--git-path", "config.worktree").trim());
    }
    const before = await Promise.all(files.map((path) => readFile(path)));
    for (const cwd of [main, linked]) {
      const calls = [];
      const run = (tool, args) => {
        calls.push([tool, ...args]);
        return tool === "npm"
          ? { status: 0, stdout: "11.9.0", stderr: "" }
          : spawnSync(tool, args, { cwd, encoding: "utf8" });
      };
      await expect(setup({ root: cwd, run })).rejects.toThrow("independent checkout");
      expect(calls.some((call) => call.includes("lfs") || call.includes("ci") || call.includes("--unset"))).toBe(false);
      expect(await Promise.all(files.map((path) => readFile(path)))).toEqual(before);
      expect(await readFile(join(cwd, "marker"), "utf8")).toBe("existing task");
    }
  }
});

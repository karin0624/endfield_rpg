import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, expect, it } from "vitest";
import { setup } from "./setup.mjs";

const asset = {
  name: "public/assets/ground/ground1.glb",
  oid_type: "sha256",
  oid: "0bad77901554e56495e34844a5e63e66380b30d48c732c5c7fbc152c9b976ef9",
  size: 58790396,
};
const endpoint = "https://github.com/karin0624/endfield_rpg.git/info/lfs";
const key = `lfs.${endpoint}.access`;
const loginFailure = "batch response: Maximum number of login attempts exceeded. Please try again later.";
const source = fileURLToPath(new URL(`../${asset.name}`, import.meta.url));
const roots = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

async function fixture(options = {}) {
  const root = await mkdtemp(join(tmpdir(), "setup-contract-"));
  roots.push(root);
  mkdirSync(join(root, ".git"));
  writeFileSync(join(root, ".git/config"), "");
  const target = join(root, asset.name);
  mkdirSync(dirname(target), { recursive: true });
  if (options.prepared) copyFileSync(source, target);
  else writeFileSync(target, "version https://git-lfs.github.com/spec/v1\n");
  if (options.lfsConfig) await writeFile(join(root, ".lfsconfig"), "[lfs]\n");
  let access = options.access ?? `local\0file:.git/config\0${key}\nbasic\0`;
  const calls = [];
  const ok = (stdout = "") => ({ status: 0, stdout, stderr: "" });
  const fail = (stderr = "required stage failed") => ({ status: 2, stdout: "", stderr });
  function run(tool, args) {
    calls.push([tool, ...args]);
    if (options.fail?.(tool, args)) return fail();
    if (tool === "npm") return ok(args[0] === "--version" ? (options.npmVersion ?? "11.9.0") : "");
    if (args[0] === "worktree") return ok(`worktree ${root}\0HEAD test-ref\0\0`);
    if (args[0] === "rev-parse") return ok(args[1] === "HEAD" ? "test-ref" : ".git/config");
    if (args[0] === "remote") return ok(endpoint.replace("/info/lfs", ""));
    if (args[0] === "ls-files") return ok();
    if (args[0] === "config") {
      if (args.includes("--get-all")) return { status: access ? 0 : 1, stdout: access, stderr: "" };
      if (args.includes("--unset")) {
        access = "";
        return ok();
      }
      return access ? ok(access) : { status: 1, stdout: "", stderr: "" };
    }
    if (args[0] === "lfs" && args[1] === "version") return ok(options.version ?? "git-lfs/3.6.1");
    if (args[0] === "lfs" && args[1] === "env") return ok(`Endpoint=${options.endpoint ?? endpoint} (auth=basic)\n`);
    if (args[0] === "lfs" && args[1] === "ls-files")
      return ok(JSON.stringify({ files: [{ ...asset, ...options.pointer }] }));
    if (args.includes("fetch")) {
      const storage = args.find((arg) => arg.startsWith("lfs.storage="))?.slice("lfs.storage=".length);
      if (options.fetchError && !storage) {
        if (options.learnOnFailure) access = `local\0file:.git/config\0${key}\nbasic\0`;
        return fail(options.fetchError);
      }
      if (storage) {
        const path = join(storage, "objects", "0b", "ad", asset.oid);
        mkdirSync(dirname(path), { recursive: true });
        if (options.corruptContrast && args.includes(`${key}=`)) writeFileSync(path, "corrupt");
        else copyFileSync(source, path);
        if (options.changeAccess && args.includes(`${key}=`))
          access += "local\0file:.git/config\0lfs.other.access\nbasic\0";
        if (options.relearn && !args.includes(`${key}=`)) access = "basic";
      }
    }
    if (args.includes("checkout") && !options.corruptCheckout) copyFileSync(source, target);
    return ok();
  }
  return { root, run, calls, target, getAccess: () => access };
}

it("prepares a pointer checkout before checks and reuses verified material without fetch or duplicate build", async () => {
  const env = await fixture();
  await setup(env);
  const check = env.calls.findIndex((call) => call.join(" ") === "npm run check");
  expect(env.calls.slice(0, check).some((call) => call.includes("checkout"))).toBe(true);
  expect(env.calls.filter((call) => call.join(" ") === "npm run check")).toHaveLength(1);
  expect(env.calls.some((call) => call.includes("build"))).toBe(false);
  env.calls.length = 0;
  await setup({ ...env, npmArgs: ["--cache", "/workspace/.npm"] });
  expect(env.calls).toContainEqual(["npm", "ci", "--cache", "/workspace/.npm"]);
  expect(env.calls.some((call) => call.includes("fetch") || call.includes("checkout"))).toBe(false);
  expect(env.calls).toContainEqual(["npm", "run", "check"]);
});

it("stops before checks when runtime, LFS install, dependencies, download, checkout or verification fail", async () => {
  for (const options of [
    { nodeVersion: "22.0.0" },
    { npmVersion: "10.0.0" },
    { fail: (_tool, args) => args.includes("install") },
    { fail: (tool, args) => tool === "npm" && args[0] === "ci" },
    { fetchError: "batch response: repository access denied" },
    { fail: (_tool, args) => args.includes("checkout") },
    { corruptCheckout: true },
    { pointer: { oid: "f".repeat(64) } },
    { pointer: { size: asset.size + 1 } },
  ]) {
    const env = await fixture(options);
    await expect(setup({ ...env, nodeVersion: options.nodeVersion ?? "24.19.0" })).rejects.toThrow();
    expect(env.calls).not.toContainEqual(["npm", "run", "check"]);
  }
});

it("proves contrast bytes before local repair and fresh standard bytes before checks", async () => {
  for (const fetchError of [
    loginFailure,
    "batch response: unexpected status 403",
    "batch response: Git credentials for https://github.com/karin0624/endfield_rpg.git not found.",
  ]) {
    const env = await fixture({ fetchError });
    await setup(env);
    const unset = env.calls.findIndex((call) => call.includes("--unset"));
    const fresh = env.calls.findIndex((call) =>
      call.some((arg) => arg.includes("lfs.storage=") && arg.includes("standard-")),
    );
    expect(unset).toBeGreaterThan(0);
    expect(fresh).toBeGreaterThan(unset);
    expect(env.getAccess()).toBe("");
    expect(env.calls.at(-1)).toEqual(["npm", "run", "check"]);
    expect(env.calls.filter((call) => call.includes("fetch")).every((call) => call.at(-1) === "test-ref")).toBe(true);
    expect(env.calls.some((call) => call.includes("credential.helper") || call.includes("setup-git"))).toBe(false);
  }
});

it("preserves unknown or shared access settings and rejects unrelated failures without diagnostic retries", async () => {
  for (const options of [
    { access: `global\0file:/tmp/global-config\0${key}\nbasic\0` },
    { access: `worktree\0file:.git/config.worktree\0${key}\nbasic\0` },
    { access: `local\0file:.git/config\0${key}\nbasic\0local\0file:.git/config\0${key}\nbasic\0` },
    { access: `local\0file:.git/config\0${key}\nnone\0` },
    { endpoint: "https://other.example/info/lfs" },
    { version: "git-lfs/4.0.0" },
    { pointer: { oid: "f".repeat(64) } },
    { lfsConfig: true },
    { fetchError: "batch response: status 401" },
    { fetchError: "object GET: status 403" },
    { fetchError: "batch response: bandwidth limit exceeded" },
    { fetchError: "batch response: status 403 bandwidth limit exceeded" },
    { fetchError: "batch response: status 403 access denied" },
  ]) {
    const env = await fixture({ fetchError: loginFailure, ...options });
    const before = env.getAccess();
    await expect(setup(env)).rejects.toThrow();
    expect(env.getAccess()).toBe(before);
    expect(env.calls.filter((call) => call.includes("fetch"))).toHaveLength(1);
    expect(env.calls).not.toContainEqual(["npm", "run", "check"]);
  }
});

it("fails closed on contrast, checksum, config change, unset or fresh verification failure", async () => {
  for (const options of [
    { fail: (_tool, args) => args.includes(`${key}=`) },
    { corruptContrast: true },
    { changeAccess: true },
    { fail: (_tool, args) => args.includes("--unset") },
    { fail: (_tool, args) => args.some((arg) => arg.startsWith("lfs.storage=") && arg.includes("standard-")) },
    { relearn: true },
  ]) {
    const env = await fixture({ fetchError: loginFailure, ...options });
    await expect(setup(env)).rejects.toThrow();
    expect(env.calls).not.toContainEqual(["npm", "run", "check"]);
    if (options.corruptContrast || options.changeAccess)
      expect(env.calls.some((call) => call.includes("--unset"))).toBe(false);
  }
});

it("propagates check failure and leaves the repository hook without duplicate setup", async () => {
  const env = await fixture({ prepared: true, fail: (tool, args) => tool === "npm" && args[0] === "run" });
  await expect(setup(env)).rejects.toThrow("npm run check failed");
  const hooks = JSON.parse(await readFile(new URL("../.codex/hooks.json", import.meta.url), "utf8"));
  expect(hooks.hooks.SessionStart).toBeUndefined();
});

it("does not retry newly learned basic or changed pre-existing access after the initial fetch fails", async () => {
  for (const access of ["", `local\0file:.git/config\0${key}\nnone\0`]) {
    const env = await fixture({ access, fetchError: loginFailure, learnOnFailure: true });
    await expect(setup(env)).rejects.toThrow();
    expect(env.calls.filter((call) => call.includes("fetch"))).toHaveLength(1);
    expect(env.calls.some((call) => call.includes("--unset"))).toBe(false);
    expect(env.calls).not.toContainEqual(["npm", "run", "check"]);
    expect(env.getAccess()).toContain("basic");
  }
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

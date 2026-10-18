import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, expect, it, vi } from "vitest";
import { openpencil } from "./openpencil.mjs";

const roots = [];
const coreFile = "packages/core/src/index.ts";
const guiFile = "src/app/title.ts";
const fontFile = "contract-font.ttf";
const workspaces = ["packages/core", "tools/release/package-artifacts"];
const upstreamFiles = {
  [coreFile]: 'export const value = "upstream";\n',
  [guiFile]: 'export const title = "upstream";\n',
};

afterEach(async () => {
  vi.unstubAllEnvs();
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

function patch({ core = "core one", gui = "upstream" } = {}) {
  const changed = {
    [coreFile]: `export const value = "${core}";\n`,
    [guiFile]: `export const title = "${gui}";\n`,
  };
  return Object.entries(changed)
    .filter(([file, value]) => value !== upstreamFiles[file])
    .map(
      ([file, value]) =>
        `diff --git a/${file} b/${file}\n--- a/${file}\n+++ b/${file}\n@@ -1 +1 @@\n-${upstreamFiles[file]}+${value}`,
    )
    .join("");
}

async function fixture(initialPatch = patch()) {
  const temporary = await mkdtemp(join(tmpdir(), "openpencil-contract-"));
  roots.push(temporary);
  const root = join(temporary, "project");
  const upstream = join(temporary, "upstream");
  const gitConfig = join(temporary, "gitconfig");
  writeFileSync(gitConfig, "");
  const gitEnv = {
    ...process.env,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: gitConfig,
    GIT_ALLOW_PROTOCOL: "file",
    GIT_TERMINAL_PROMPT: "0",
  };
  const put = (base, file, value) => {
    const target = join(base, file);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, value);
  };
  for (const [file, content] of Object.entries({
    ...upstreamFiles,
    ".gitignore": "node_modules/\npackages/*/dist/\npackages/core/assets/*.ttf\n.endfield*\n",
    "package.json": JSON.stringify({ name: "openpencil-fixture", version: "0.16.0", private: true, workspaces }),
    "bun.lock": '{ "lockfileVersion": 1 }\n',
    "packages/core/package.json": '{ "name": "@open-pencil/core", "version": "0.16.0" }\n',
    "tools/release/package-artifacts/package.json": '{ "name": "package-artifacts", "version": "0.16.0" }\n',
    "packages/core/assets/.gitkeep": "",
    "packages/cli/src/index.ts": 'console.log("fixture CLI");\n',
  }))
    put(upstream, file, content);
  const git = (...args) => {
    const result = spawnSync("git", args, { cwd: upstream, env: gitEnv, encoding: "utf8" });
    if (result.error) throw result.error;
    expect(result.status, result.stderr).toBe(0);
    return result.stdout;
  };
  git("init", "--quiet", "--initial-branch=main");
  git("add", ".");
  git("-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "--quiet", "-m", "fixture");
  git("tag", "v0.16.0");
  const revision = git("rev-parse", "HEAD").trim();
  const source = join(root, ".openpencil", revision);
  const patchFile = join(root, "scripts/openpencil.patch");
  const font = join(root, "art-src/openpencil/fonts", fontFile);
  const master = join(root, "art-src/openpencil/endfield-rpg.fig");
  put(root, "scripts/openpencil.patch", initialPatch);
  put(root, `art-src/openpencil/fonts/${fontFile}`, "font one");
  put(root, "art-src/openpencil/endfield-rpg.fig", "native master fixture");
  put(root, "node_modules/bun/bin/bun.exe", "");
  const calls = [];
  const dependencyMarker = join(source, "node_modules/dependency-marker");
  const buildOutput = join(source, "packages/core/dist/index.js");
  function run(tool, args, cwd, options = {}) {
    calls.push({ tool, args: [...args], cwd, env: options.env });
    if (tool === "git") {
      const result = spawnSync(tool, args, {
        cwd,
        encoding: "utf8",
        env: { ...options.env, ...gitEnv },
      });
      if (result.error) throw result.error;
      if (options.quiet) return result.status === 0;
      if (result.status !== 0) throw new Error(`git ${args[0]} failed: ${result.stderr}`);
      return options.capture ? result.stdout : true;
    }
    if (basename(tool) === "node") {
      expect(args[0]).toBe(join(root, "scripts/run-design-verification.mjs"));
      return true;
    }
    expect(basename(tool)).toMatch(/^bun(?:\.exe)?$/);
    if (args[0] === "install") {
      put(cwd, "node_modules/.bin/vite", "installed vite");
      put(cwd, "node_modules/dependency-marker", "installed dependencies");
      const dependency = join(cwd, "node_modules/.bun/contract-dependency/node_modules/contract-dependency");
      put(dependency, "index.js", "installed workspace dependency");
      for (const workspace of workspaces) {
        const link = join(cwd, workspace, "node_modules/contract-dependency");
        mkdirSync(dirname(link), { recursive: true });
        symlinkSync(relative(dirname(link), dependency), link, "dir");
      }
    }
    if (args.includes("build:packages")) {
      for (const workspace of workspaces)
        expect(readFileSync(join(cwd, workspace, "node_modules/contract-dependency/index.js"), "utf8")).toBe(
          "installed workspace dependency",
        );
      put(
        cwd,
        "packages/core/dist/index.js",
        JSON.stringify({
          core: readFileSync(join(cwd, coreFile), "utf8"),
          font: readFileSync(join(cwd, "packages/core/assets", fontFile), "utf8"),
        }),
      );
    }
    return options.capture ? "" : true;
  }
  return {
    root,
    source,
    revision,
    repository: pathToFileURL(upstream).href,
    run,
    calls,
    patchFile,
    font,
    master,
    dependencyMarker,
    buildOutput,
    sourceRevision: () => git("-C", source, "rev-parse", "HEAD").trim(),
  };
}

const installs = (calls) => calls.filter((call) => call.tool !== "git" && call.args[0] === "install");
const builds = (calls) => calls.filter((call) => call.args.includes("build:packages"));
const downloads = (calls) =>
  calls.filter((call) => call.tool === "git" && call.args.some((arg) => ["clone", "fetch", "pull"].includes(arg)));

it("reuses a version checkout and dependencies, rebuilding only package or font changes", async () => {
  const env = await fixture();
  await openpencil(["--setup"], env);
  expect(downloads(env.calls)).toHaveLength(1);
  expect(downloads(env.calls)[0].args).toEqual(expect.arrayContaining(["--branch", "v0.16.0", env.repository]));
  expect(installs(env.calls)).toHaveLength(1);
  expect(builds(env.calls)).toHaveLength(1);
  expect(await readFile(join(env.source, coreFile), "utf8")).toBe('export const value = "core one";\n');
  expect(await readFile(join(env.source, "packages/core/assets", fontFile), "utf8")).toBe("font one");
  const firstBuild = await readFile(env.buildOutput, "utf8");
  await writeFile(env.dependencyMarker, "keep installed dependencies");

  env.calls.length = 0;
  await openpencil(["--setup"], env);
  expect(downloads(env.calls)).toHaveLength(0);
  expect(installs(env.calls)).toHaveLength(0);
  expect(builds(env.calls)).toHaveLength(0);
  expect(await readFile(env.buildOutput, "utf8")).toBe(firstBuild);

  await writeFile(env.patchFile, patch({ gui: "GUI update" }));
  env.calls.length = 0;
  await openpencil(["--setup"], env);
  expect(downloads(env.calls)).toHaveLength(0);
  expect(installs(env.calls)).toHaveLength(0);
  expect(builds(env.calls)).toHaveLength(0);
  expect(await readFile(join(env.source, guiFile), "utf8")).toBe('export const title = "GUI update";\n');
  expect(await readFile(env.buildOutput, "utf8")).toBe(firstBuild);

  await writeFile(env.patchFile, patch({ core: "core two", gui: "GUI update" }));
  env.calls.length = 0;
  await openpencil(["--setup"], env);
  expect(downloads(env.calls)).toHaveLength(0);
  expect(installs(env.calls)).toHaveLength(0);
  expect(builds(env.calls)).toHaveLength(1);
  expect(await readFile(join(env.source, coreFile), "utf8")).toBe('export const value = "core two";\n');
  expect(JSON.parse(await readFile(env.buildOutput, "utf8")).core).toBe('export const value = "core two";\n');

  await writeFile(env.font, "font two");
  env.calls.length = 0;
  await openpencil(["--setup"], env);
  expect(downloads(env.calls)).toHaveLength(0);
  expect(installs(env.calls)).toHaveLength(0);
  expect(builds(env.calls)).toHaveLength(1);
  expect(JSON.parse(await readFile(env.buildOutput, "utf8")).font).toBe("font two");
  expect(await readFile(env.dependencyMarker, "utf8")).toBe("keep installed dependencies");
  expect(env.sourceRevision()).toBe(env.revision);

  env.calls.length = 0;
  await openpencil([], env);
  await openpencil(["info", "art-src/openpencil/endfield-rpg.fig"], env);
  await openpencil(["--verify-design", "--select", "home"], env);
  await openpencil(["--export-assets", "--output", "preview"], env);
  expect(env.calls.filter((call) => call.tool === "git")).toHaveLength(0);
  expect(installs(env.calls)).toHaveLength(0);
  expect(builds(env.calls)).toHaveLength(0);
  expect(env.calls).toHaveLength(4);
  const verification = env.calls.find((call) => call.args.includes("--select"));
  expect(verification.cwd).toBe(env.root);
  expect(verification.args).toEqual([join(env.root, "scripts/run-design-verification.mjs"), "--select", "home"]);
  const assets = env.calls.find((call) => call.args.includes("preview"));
  expect(assets.cwd).toBe(env.root);
  expect(assets.args).toEqual([join(env.root, "scripts/export-design-assets.mjs"), env.source, "--output", "preview"]);
  const gui = env.calls.find((call) => call.args.includes("dev"));
  expect(gui.cwd).toBe(env.source);
  expect(gui.env.VITE_OPENPENCIL_STARTUP_FILE).toBe(env.master.replaceAll("\\", "/"));
  const cli = env.calls.find((call) => call.args.includes("info"));
  expect(cli.cwd).toBe(env.root);
  expect(cli.args.slice(-2)).toEqual(["info", "art-src/openpencil/endfield-rpg.fig"]);
});

it("launches the editor without MCP by default and preserves explicit MCP opt-in", async () => {
  const env = await fixture();
  await openpencil(["--setup"], env);
  env.calls.length = 0;
  vi.stubEnv("OPENPENCIL_DEV_MCP", undefined);

  await openpencil([], env);
  expect(env.calls[0].env.OPENPENCIL_DEV_MCP).toBe("0");
  expect(env.calls[0].env.VITE_OPENPENCIL_STARTUP_FILE).toBe(env.master.replaceAll("\\", "/"));

  await openpencil(["info", "art-src/openpencil/endfield-rpg.fig"], env);
  expect(env.calls[1].env.OPENPENCIL_DEV_MCP).toBeUndefined();

  vi.stubEnv("OPENPENCIL_DEV_MCP", "1");
  await openpencil(["--app", "--port", "1422"], env);
  expect(env.calls[2].env.OPENPENCIL_DEV_MCP).toBe("1");
  expect(env.calls[2].args).toEqual(["run", "dev", "--open", "--port", "1422"]);
  expect(env.calls.filter((call) => call.tool === "git")).toHaveLength(0);
  expect(installs(env.calls)).toHaveLength(0);
  expect(builds(env.calls)).toHaveLength(0);
});

it("migrates a legacy checkout with an older patch without fetching or reinstalling dependencies", async () => {
  const env = await fixture();
  await openpencil(["--setup"], env);
  const { inputHash } = JSON.parse(await readFile(join(env.source, ".endfield-install.json"), "utf8"));
  const legacy = join(env.root, ".openpencil", `${env.revision.slice(0, 12)}-legacy-patch`);
  await writeFile(env.dependencyMarker, "keep legacy dependencies");
  await rename(env.source, legacy);
  await writeFile(join(legacy, ".endfield-ready"), `${env.revision}\n${inputHash}\n`);
  await writeFile(env.patchFile, patch({ core: "migrated core", gui: "migrated GUI" }));

  env.calls.length = 0;
  await openpencil(["--setup"], env);
  for (const call of downloads(env.calls)) {
    expect(call.args[0]).toBe("clone");
    expect(call.args).toContain("--local");
    expect(call.args.slice(-2)).toEqual([legacy, env.source]);
    expect(call.args).not.toContain(env.repository);
  }
  expect(installs(env.calls)).toHaveLength(0);
  expect(builds(env.calls)).toHaveLength(1);
  expect(await readFile(env.dependencyMarker, "utf8")).toBe("keep legacy dependencies");
  for (const workspace of workspaces)
    expect(await readFile(join(env.source, workspace, "node_modules/contract-dependency/index.js"), "utf8")).toBe(
      "installed workspace dependency",
    );
  expect(await readFile(join(env.source, coreFile), "utf8")).toBe('export const value = "migrated core";\n');
  expect(await readFile(join(env.source, guiFile), "utf8")).toBe('export const title = "migrated GUI";\n');
  expect(JSON.parse(await readFile(env.buildOutput, "utf8")).core).toBe('export const value = "migrated core";\n');
  expect(env.sourceRevision()).toBe(env.revision);
});

it("restores the previous applied patch when a replacement cannot apply", async () => {
  const previous = patch({ gui: "previous GUI" });
  const env = await fixture(previous);
  await openpencil(["--setup"], env);
  const before = await Promise.all([coreFile, guiFile].map((file) => readFile(join(env.source, file), "utf8")));
  const output = await readFile(env.buildOutput, "utf8");
  await writeFile(env.dependencyMarker, "preserved dependencies");
  const broken = patch({ core: "replacement core", gui: "replacement GUI" }).replace(
    '-export const value = "upstream";',
    '-export const value = "missing upstream line";',
  );
  await writeFile(env.patchFile, broken);
  env.calls.length = 0;
  await expect(openpencil(["--setup"], env)).rejects.toThrow();
  expect(await Promise.all([coreFile, guiFile].map((file) => readFile(join(env.source, file), "utf8")))).toEqual(
    before,
  );
  expect(await readFile(env.buildOutput, "utf8")).toBe(output);
  expect(await readFile(env.dependencyMarker, "utf8")).toBe("preserved dependencies");
  expect(downloads(env.calls)).toHaveLength(0);
  expect(installs(env.calls)).toHaveLength(0);
  expect(builds(env.calls)).toHaveLength(0);

  await writeFile(env.patchFile, previous);
  env.calls.length = 0;
  await openpencil(["info", "art-src/openpencil/endfield-rpg.fig"], env);
  expect(env.calls).toHaveLength(1);
  expect(env.calls[0].tool).not.toBe("git");
  expect(env.calls[0].args).toContain("info");
});

it("requires explicit setup for missing or stale installation without fetching during normal startup", async () => {
  const env = await fixture();
  await expect(openpencil([], env)).rejects.toThrow(/openpencil:setup|--setup/);
  expect(env.calls).toHaveLength(0);
  await openpencil(["--setup"], env);
  await writeFile(env.patchFile, patch({ gui: "not installed yet" }));
  env.calls.length = 0;
  await expect(openpencil(["info", "art-src/openpencil/endfield-rpg.fig"], env)).rejects.toThrow(
    /openpencil:setup|--setup/,
  );
  expect(env.calls).toHaveLength(0);
});

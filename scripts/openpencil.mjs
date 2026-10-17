import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { access, mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const project = dirname(dirname(fileURLToPath(import.meta.url)));
const pinnedRevision = "ffe2fc5798468988a5943c5f5737905c3c7a28b5";
const upstream = "https://github.com/open-pencil/open-pencil.git";

async function optionalFile(path) {
  try {
    return await readFile(path);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

const exists = (path) =>
  access(path).then(
    () => true,
    () => false,
  );

async function dependencyFingerprint(directory) {
  return createHash("sha256")
    .update(await readFile(join(directory, "package.json")))
    .update(await readFile(join(directory, "bun.lock")))
    .digest("hex");
}

function execute(command, args, cwd, { env, quiet = false, capture = false } = {}) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: quiet ? "ignore" : ["inherit", capture ? "pipe" : "inherit", "inherit"],
    });
    let output = "";
    child.stdout?.on("data", (chunk) => {
      output += chunk;
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (quiet) resolveRun(code === 0);
      else if (code === 0) resolveRun(capture ? output : true);
      else reject(Object.assign(new Error(`${command} exited with ${signal ?? code}`), { exitCode: code ?? 1 }));
    });
  });
}

export async function openpencil(
  args = [],
  { root = project, revision = pinnedRevision, repository = upstream, run = execute } = {},
) {
  const patch = await readFile(join(root, "scripts/openpencil.patch"));
  const fonts = [];
  const inputs = createHash("sha256").update(patch);
  for (const name of (await readdir(join(root, "art-src/openpencil/fonts"))).sort()) {
    const bytes = await readFile(join(root, "art-src/openpencil/fonts", name));
    fonts.push({ name, bytes });
    inputs.update(name).update(bytes);
  }
  const inputHash = inputs.digest("hex");
  const source = join(root, ".openpencil", revision);
  const bun = join(root, "node_modules/bun/bin/bun.exe");
  const env = { ...process.env, PATH: join(root, "node_modules/.bin") + delimiter + (process.env.PATH ?? "") };
  const command = (tool, argv, cwd = source, options = {}) => run(tool, argv, cwd, { env, ...options });
  const statePath = join(source, ".endfield-install.json");
  const appliedPath = join(source, ".endfield-applied.patch");
  const vite = join(source, "node_modules/.bin/vite");
  const core = join(source, "packages/core/dist/index.js");
  const state = JSON.parse((await optionalFile(statePath))?.toString() ?? "{}");
  const ready =
    state.revision === revision && state.inputHash === inputHash && (await exists(vite)) && (await exists(core));

  if (args[0] !== "--setup") {
    if (!ready)
      throw new Error("OpenPencil needs installation or updated patches. Run npm run openpencil:setup (or npm ci).");
    if (args[0] === "--render") {
      await command(bun, [join(root, "scripts/render-openpencil.mjs"), source, ...args.slice(1)], root);
    } else if (args[0] === "--verify-design") {
      await command(bun, [join(root, "scripts/verify-design.mjs"), source, ...args.slice(1)], root);
    } else if (args[0] === "--export-assets") {
      await command(bun, [join(root, "scripts/export-design-assets.mjs"), source, ...args.slice(1)], root);
    } else if (args.length === 0 || args[0] === "--app") {
      const master = join(root, "art-src/openpencil/endfield-rpg.fig");
      await access(master);
      env.VITE_OPENPENCIL_STARTUP_FILE = master.replaceAll("\\", "/");
      env.OPENPENCIL_DEV_MCP ??= "0";
      await command(bun, ["run", "dev", "--open", ...args.slice(1)]);
    } else {
      await command(bun, [join(source, "packages/cli/src/index.ts"), ...args], root);
    }
    return { source };
  }

  if (ready) return { source };
  await mkdir(dirname(source), { recursive: true });
  let cached;
  if (!(await exists(join(source, ".git"))) || !(await exists(join(source, "node_modules")))) {
    const matching = `${revision.slice(0, 12)}-${inputHash.slice(0, 12)}`;
    const candidates = (await readdir(dirname(source))).filter((name) => name.startsWith(`${revision.slice(0, 12)}-`));
    candidates.sort((a, b) => Number(b === matching) - Number(a === matching));
    for (const name of candidates) {
      const path = join(dirname(source), name);
      if ((await optionalFile(join(path, ".endfield-ready")))?.toString().split("\n")[0] === revision) {
        cached = path;
        break;
      }
    }
  }
  let adopted = false;
  if (!(await exists(join(source, ".git")))) {
    // Reuse an installed copy of this exact release and patch, including its dependencies.
    if (cached && (await optionalFile(join(cached, ".endfield-ready")))?.toString() === `${revision}\n${inputHash}\n`) {
      await rename(cached, source);
      await writeFile(appliedPath, patch);
      adopted = true;
    } else if (cached) {
      // A local clone unpacks the cached release without contacting its remote or copying old patches.
      await command("git", ["clone", "--local", "--no-checkout", cached, source], root);
      await command("git", ["checkout", "--detach", revision]);
    } else {
      await command("git", ["clone", "--depth", "1", "--branch", "v0.16.0", repository, source], root);
      await command("git", ["checkout", "--detach", revision]);
    }
  }
  const actualRevision = (await command("git", ["rev-parse", "HEAD"], source, { capture: true })).trim();
  if (actualRevision !== revision) throw new Error("OpenPencil source differs from the pinned release.");
  state.revision = revision;
  const previousInputHash = state.inputHash;
  delete state.inputHash;
  const saveState = () => writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`);
  await saveState();

  const previous = await optionalFile(appliedPath);
  if (!previous?.equals(patch)) {
    const nextPath = join(source, ".endfield-next.patch");
    await writeFile(nextPath, patch);
    if (previous?.length) {
      await command("git", ["apply", "--reverse", "--check", appliedPath]);
      await command("git", ["apply", "--reverse", appliedPath]);
    }
    try {
      if (patch.length) await command("git", ["apply", nextPath]);
    } catch (error) {
      if (previous?.length) await command("git", ["apply", appliedPath]);
      state.inputHash = previousInputHash;
      await saveState();
      throw error;
    }
    await rename(nextPath, appliedPath);
  }

  if (!(await command("git", ["diff", "--quiet", revision, "--", "package.json", "bun.lock"], source, { quiet: true })))
    throw new Error("OpenPencil package.json or bun.lock differs from the pinned release.");
  const dependencyHash = await dependencyFingerprint(source);
  for (const { name, bytes } of fonts) {
    const target = join(source, "packages/core/assets", name);
    if (!(await optionalFile(target))?.equals(bytes)) await writeFile(target, bytes);
  }

  const numstat = patch.length
    ? await command("git", ["apply", "--numstat", "-z", appliedPath], source, { capture: true })
    : "";
  const packagePaths = new Set(
    numstat
      .split("\0")
      .filter(Boolean)
      .map((record) => record.split("\t").slice(2).join("\t"))
      .filter((path) => path.startsWith("packages/") || path.startsWith("tools/release/package-artifacts/")),
  );
  const buildInputs = createHash("sha256").update(revision);
  for (const path of [...packagePaths].sort())
    buildInputs
      .update(path)
      .update("\0")
      .update((await optionalFile(join(source, path))) ?? "<deleted>");
  for (const { name, bytes } of fonts) buildInputs.update(name).update(bytes);
  const buildHash = buildInputs.digest("hex");
  if (adopted) {
    state.dependencyHash = dependencyHash;
    state.buildHash = buildHash;
  }
  if (
    cached &&
    !(await exists(join(source, "node_modules"))) &&
    (await exists(join(cached, "node_modules/.bin/vite"))) &&
    (await dependencyFingerprint(cached)) === dependencyHash
  ) {
    const workspaces = JSON.parse(await readFile(join(source, "package.json"), "utf8")).workspaces ?? [];
    for (const workspace of [...workspaces, ""]) {
      const installed = join(cached, workspace, "node_modules");
      if (await exists(installed)) {
        const target = join(source, workspace, "node_modules");
        await mkdir(dirname(target), { recursive: true });
        await rename(installed, target);
      }
    }
    state.dependencyHash = dependencyHash;
    await saveState();
  }
  if (state.dependencyHash !== dependencyHash || !(await exists(vite))) {
    await command(bun, ["install", "--frozen-lockfile"]);
    state.dependencyHash = dependencyHash;
    await saveState();
  }
  if (state.buildHash !== buildHash || !(await exists(core))) {
    await command(bun, ["run", "build:packages"]);
    state.buildHash = buildHash;
  }
  state.inputHash = inputHash;
  await saveState();
  return { source };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await openpencil(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = error.exitCode ?? 1;
  }
}

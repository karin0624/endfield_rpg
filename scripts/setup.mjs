import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function command(tool, args, cwd) {
  const result = spawnSync(tool, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    // Keep npm's long-running checks visible; Git output is used for diagnosis.
    stdio: tool === "npm" && args[0] !== "--version" ? "inherit" : "pipe",
  });
  if (result.error) throw result.error;
  return result;
}

function requireSuccess(result, stage) {
  if (result.status !== 0) {
    // No credential/header dumps or signed download URLs in failure reports.
    const detail = (result.stderr || "").replace(/https?:\/\/[^\s'"<>]+/g, (value) => {
      const url = new URL(value);
      return `${url.origin}${url.pathname}`;
    });
    throw new Error(`${stage} failed (exit ${result.status}). ${detail}`);
  }
  return result.stdout || "";
}

async function matches(path, asset) {
  try {
    if ((await stat(path)).size !== asset.size) return false;
    const hash = createHash("sha256");
    for await (const chunk of createReadStream(path)) hash.update(chunk);
    return hash.digest("hex") === asset.oid;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

export async function setup({
  root = fileURLToPath(new URL("..", import.meta.url)),
  npmArgs = [],
  run = command,
  nodeVersion = process.versions.node,
} = {}) {
  const git = (...args) => run("git", args, root);
  const requiredGit = (...args) => requireSuccess(git(...args), `git ${args[0]}`);
  if (nodeVersion.split(".")[0] !== "24") throw new Error("Setup requires Node.js 24.");
  const npmVersion = requireSuccess(run("npm", ["--version"], root), "npm version").trim();
  if (npmVersion.split(".")[0] !== "11") throw new Error("Setup requires npm 11.");
  // Local filters, hooks and LFS challenge learning can mutate common config.
  // Even worktreeConfig does not redirect LFS's SetLocal access-learning path.
  const worktrees = requiredGit("worktree", "list", "--porcelain", "-z")
    .split("\0")
    .filter((field) => field.startsWith("worktree "));
  if (worktrees.length !== 1)
    throw new Error("Setup requires an independent checkout; shared worktree configuration is preserved.");
  requiredGit("lfs", "install", "--local");
  requireSuccess(run("npm", ["ci", ...npmArgs], root), "npm ci");

  const ref = requiredGit("rev-parse", "HEAD").trim();
  const assets = JSON.parse(requiredGit("lfs", "ls-files", "--json", ref)).files.filter((asset) =>
    asset.name.startsWith("public/assets/"),
  );
  if (!assets.some((asset) => asset.name === "public/assets/ground/ground1.glb"))
    throw new Error("Required ground LFS pointer missing.");
  for (const asset of assets) {
    if (asset.oid_type !== "sha256" || !/^[a-f0-9]{64}$/.test(asset.oid) || !Number.isSafeInteger(asset.size))
      throw new Error(`Invalid LFS pointer: ${asset.name}`);
  }
  const missing = [];
  for (const asset of assets) {
    if (!(await matches(join(root, asset.name), asset))) missing.push(asset);
  }
  if (missing.length) {
    const paths = missing.map((asset) => asset.name);
    requiredGit("lfs", "fetch", `--include=${paths.join(",")}`, "--exclude=", "origin", ref);
    requiredGit("lfs", "checkout", ...paths);
  }
  for (const asset of assets) {
    if (!(await matches(join(root, asset.name), asset))) throw new Error(`LFS oid/size mismatch: ${asset.name}`);
    process.stdout.write(`Verified LFS ${asset.name}: sha256:${asset.oid}, ${asset.size} bytes\n`);
  }
  requireSuccess(run("npm", ["run", "check"], root), "npm run check");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await setup({ npmArgs: process.argv.slice(2) });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

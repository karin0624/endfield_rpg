import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdtemp, realpath, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const endpoint = "https://github.com/karin0624/endfield_rpg.git/info/lfs";
const accessKey = `lfs.${endpoint}.access`;
// PR108's demonstrated recovery applies only to this endpoint and object.
const recordedAsset = {
  name: "public/assets/ground/ground1.glb",
  oid: "0bad77901554e56495e34844a5e63e66380b30d48c732c5c7fbc152c9b976ef9",
  size: 58790396,
};

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

function objectPath(storage, asset) {
  return join(storage, "objects", asset.oid.slice(0, 2), asset.oid.slice(2, 4), asset.oid);
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
  requiredGit("lfs", "install", "--local");
  requireSuccess(run("npm", ["ci", ...npmArgs], root), "npm ci");

  const ref = requiredGit("rev-parse", "HEAD").trim();
  const assets = JSON.parse(requiredGit("lfs", "ls-files", "--json", ref)).files.filter((asset) =>
    asset.name.startsWith("public/assets/"),
  );
  if (!assets.some((asset) => asset.name === recordedAsset.name))
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
    const fetchArgs = ["lfs", "fetch", `--include=${paths.join(",")}`, "--exclude=", "origin", ref];
    const fetched = git(...fetchArgs);
    if (fetched.status !== 0) {
      // Diagnose only PR108's known local learned state. A general denial,
      // quota, other endpoint, version, object or shared configuration stops here.
      const lfsVersion = requiredGit("lfs", "version");
      const lfsEnv = requiredGit("lfs", "env");
      const settings = git("config", "--null", "--show-origin", "--show-scope", "--get-regexp", "^lfs\\..*\\.access$");
      const localConfig = await realpath(resolve(root, requiredGit("rev-parse", "--git-path", "config").trim()));
      const lfsConfigTracked = requiredGit("ls-files", "--", ".lfsconfig");
      const lfsConfigPresent = await stat(join(root, ".lfsconfig")).then(
        () => true,
        (error) => {
          if (error.code === "ENOENT") return false;
          throw error;
        },
      );
      const fields = (settings.stdout || "").split("\0").filter(Boolean);
      const clearDenial =
        /quota|bandwidth|rate.limit|access.denied|permission.denied|resource.not.accessible|limit.exceeded/i.test(
          fetched.stderr || "",
        );
      const eligible =
        !clearDenial &&
        !lfsConfigTracked.trim() &&
        !lfsConfigPresent &&
        requiredGit("remote", "get-url", "origin").trim() === endpoint.replace("/info/lfs", "") &&
        settings.status === 0 &&
        fields.length === 3 &&
        fields[0] === "local" &&
        fields[1].startsWith("file:") &&
        (await realpath(resolve(root, fields[1].slice(5)))) === localConfig &&
        fields[2] === `${accessKey}\nbasic` &&
        /git-lfs\/3\.(?:6|8)\./.test(lfsVersion) &&
        lfsEnv.split("\n").includes(`Endpoint=${endpoint} (auth=basic)`) &&
        missing.length === 1 &&
        missing[0].name === recordedAsset.name &&
        missing[0].oid === recordedAsset.oid &&
        missing[0].size === recordedAsset.size &&
        (/batch response:.*403/.test(fetched.stderr || "") ||
          (fetched.stderr || "").includes(
            "batch response: Git credentials for https://github.com/karin0624/endfield_rpg.git not found.",
          ));
      if (!eligible) requireSuccess(fetched, "LFS fetch (outside recorded recovery conditions)");

      process.stdout.write(
        `LFS recovery candidate: ${accessKey}=basic, local ${localConfig}; same ref ${ref} and recorded object.\n`,
      );
      const storage = await mkdtemp(join(tmpdir(), "endfield-lfs-contrast-"));
      try {
        requiredGit("-c", `${accessKey}=`, "-c", `lfs.storage=${storage}`, ...fetchArgs);
        if (!(await matches(objectPath(storage, recordedAsset), recordedAsset)))
          throw new Error("LFS contrast object oid/size mismatch; learned access preserved.");
        process.stdout.write("LFS command-scope contrast: recorded oid/size verified.\n");
        // Do not remove a value that changed during challenge negotiation.
        const current = requiredGit(
          "config",
          "--null",
          "--show-origin",
          "--show-scope",
          "--get-regexp",
          "^lfs\\..*\\.access$",
        );
        if (current !== settings.stdout) throw new Error("LFS access changed during contrast; stopping.");
        requiredGit("config", "--local", "--unset", accessKey, "^basic$");
      } finally {
        await rm(storage, { recursive: true, force: true });
      }
      // Prove standard negotiation after repair from an empty, isolated cache.
      const fresh = await mkdtemp(join(tmpdir(), "endfield-lfs-standard-"));
      try {
        requiredGit("-c", `lfs.storage=${fresh}`, ...fetchArgs);
        if (!(await matches(objectPath(fresh, recordedAsset), recordedAsset)))
          throw new Error("Standard LFS object oid/size mismatch after recovery.");
        process.stdout.write(
          "LFS fresh standard fetch after local learned-value repair: recorded oid/size verified.\n",
        );
        requiredGit("-c", `lfs.storage=${fresh}`, "lfs", "checkout", ...paths);
      } finally {
        await rm(fresh, { recursive: true, force: true });
      }
      const remaining = git("config", "--get-all", accessKey);
      if (remaining.status !== 1) throw new Error("LFS access relearned or could not be confirmed absent; stopping.");
    } else {
      requiredGit("lfs", "checkout", ...paths);
    }
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

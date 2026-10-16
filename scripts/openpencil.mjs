import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { access, cp, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { delimiter, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const project = dirname(dirname(fileURLToPath(import.meta.url)));
const revision = "ffe2fc5798468988a5943c5f5737905c3c7a28b5";
const patch = join(project, "scripts/openpencil.patch");
const fonts = join(project, "art-src/openpencil/fonts");
const inputs = createHash("sha256").update(await readFile(patch));
for (const file of (await readdir(fonts)).sort()) inputs.update(file).update(await readFile(join(fonts, file)));
const inputHash = inputs.digest("hex");
const source = join(project, ".openpencil", `${revision.slice(0, 12)}-${inputHash.slice(0, 12)}`);
const bun = join(project, "node_modules/bun/bin/bun.exe");
const env = {
  ...process.env,
  PATH: `${join(project, "node_modules/.bin")}${delimiter}${process.env.PATH ?? ""}`,
};
const exists = (path) =>
  access(path).then(
    () => true,
    () => false,
  );
const run = (command, args, cwd, quiet = false) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: quiet ? "ignore" : "inherit" });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (quiet) resolve(code === 0);
      else if (code === 0) resolve();
      else reject(new Error(`${command} exited with ${signal ?? code}`));
    });
  });

if (!(await exists(join(source, ".endfield-ready")))) {
  console.error("Preparing OpenPencil 0.16.0 (first run requires network access)...");
  await mkdir(dirname(source), { recursive: true });
  if (!(await exists(join(source, ".git")))) {
    await run(
      "git",
      ["clone", "--depth", "1", "--branch", "v0.16.0", "https://github.com/open-pencil/open-pencil.git", source],
      project,
    );
    await run("git", ["checkout", "--detach", revision], source);
  }
  if (!(await run("git", ["diff", "--quiet", revision, "--", "package.json", "bun.lock"], source, true))) {
    throw new Error("OpenPencil source or lockfile differs from the pinned release.");
  }
  if (!(await run("git", ["apply", "--reverse", "--check", patch], source, true))) {
    await run("git", ["apply", "--check", patch], source);
    await run("git", ["apply", patch], source);
  }
  await cp(fonts, join(source, "packages/core/assets"), { recursive: true });
  await run(bun, ["install", "--frozen-lockfile"], source);
  await run(bun, ["run", "build:packages"], source);
  await writeFile(join(source, ".endfield-ready"), `${revision}\n${inputHash}\n`);
}

if (process.argv[2] === "--render") {
  await run(bun, [join(project, "scripts/render-openpencil.mjs"), source, ...process.argv.slice(3)], project);
} else if (process.argv[2] === "--app") {
  await run(bun, ["run", "dev", ...process.argv.slice(3)], source);
} else {
  await run(bun, [join(source, "packages/cli/src/index.ts"), ...process.argv.slice(2)], project);
}

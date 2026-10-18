import { createHash } from "node:crypto";
import { appendFile, glob, readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Per-component source, story, asset and .fig changes belong to target signatures.
// Only shared rendering and selection inputs invalidate the whole pipeline.
const inputs = [
  "package-lock.json",
  ".storybook/*",
  "vitest.storybook.config.ts",
  "scripts/design-*.mjs",
  "scripts/verify-design*.mjs",
  "scripts/run-design-verification.mjs",
  "scripts/compare-png.mjs",
  "scripts/render-openpencil*.mjs",
  "scripts/openpencil.mjs",
  "scripts/openpencil.patch",
  "scripts/storybook-design-dependencies.ts",
  "scripts/storybook-design-manifest.mjs",
];

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

/** The same fingerprint is used by local change selection and CI cache lookup. */
export async function designPipelineFingerprint(root = process.cwd()) {
  const paths = [];
  for await (const entry of glob(inputs, { cwd: root, withFileTypes: true }))
    if (entry.isFile() && !entry.name.includes(".test.") && entry.name !== "design-artifacts.mjs")
      paths.push(relative(root, resolve(entry.parentPath, entry.name)).replaceAll("\\", "/"));
  const files = Object.fromEntries(
    await Promise.all(
      [...new Set(paths)].sort().map(async (file) => [file, sha256(await readFile(resolve(root, file)))]),
    ),
  );
  return { hash: sha256(JSON.stringify(files)), files };
}

export function designSignatureCacheKeys({ pipelineHash, prNumber, testedSha, baseSha }) {
  const prefix = `design-signatures-v1-${pipelineHash}`;
  const scope = prNumber ? `pr-${prNumber}` : "main";
  return {
    key: `${prefix}-${scope}-${testedSha}`,
    previous: prNumber ? `${prefix}-${scope}-` : "",
    base: baseSha ? `${prefix}-main-${baseSha}` : "",
    main: `${prefix}-main-`,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const fingerprint = await designPipelineFingerprint();
  if (process.argv.includes("--github-output")) {
    const keys = designSignatureCacheKeys({
      pipelineHash: fingerprint.hash,
      prNumber: process.env.PR_NUMBER,
      testedSha: process.env.TESTED_SHA,
      baseSha: process.env.BASE_SHA,
    });
    await appendFile(
      process.env.GITHUB_OUTPUT,
      `${Object.entries(keys)
        .map(([key, value]) => `${key}=${value}`)
        .join("\n")}\n`,
    );
  } else process.stdout.write(`${JSON.stringify(fingerprint, null, 2)}\n`);
}

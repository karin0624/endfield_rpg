import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterEach, expect, it } from "vitest";
import { designPipelineFingerprint, designSignatureCacheKeys } from "./design-pipeline.mjs";

const temporary = [];
afterEach(async () => {
  for (const root of temporary.splice(0)) await rm(root, { recursive: true, force: true });
});

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "design-pipeline-"));
  temporary.push(root);
  const put = async (path, value) => {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), value);
  };
  await put("scripts/verify-design-browser.mjs", "render");
  await put(".storybook/preview.ts", "theme");
  await put("package-lock.json", "dependencies");
  return { root, put };
}

it("invalidates shared rendering inputs while leaving component, fixture and design changes to target selection", async () => {
  const doc = await fixture();
  const before = await designPipelineFingerprint(doc.root);
  for (const path of [
    "src/Button.svelte",
    "src/Button.stories.ts",
    ".storybook/fixtures/Button.ts",
    "art-src/openpencil/endfield-rpg.fig",
    "scripts/verify-design.test.mjs",
    "scripts/design-artifacts.mjs",
  ])
    await doc.put(path, "new target input or diagnostics");
  expect(await designPipelineFingerprint(doc.root)).toEqual(before);
  await doc.put("scripts/verify-design-browser.mjs", "new renderer");
  const after = await designPipelineFingerprint(doc.root);
  expect(after.hash).not.toBe(before.hash);
  expect(after.files["scripts/verify-design-browser.mjs"]).not.toBe(before.files["scripts/verify-design-browser.mjs"]);
});

it("tracks added and deleted shared helpers independently of the absolute checkout directory", async () => {
  const first = await fixture();
  const second = await fixture();
  const original = await designPipelineFingerprint(first.root);
  expect(await designPipelineFingerprint(second.root)).toEqual(original);
  await first.put("scripts/design-workers.mjs", "concurrency");
  expect((await designPipelineFingerprint(first.root)).hash).not.toBe(original.hash);
  await rm(join(first.root, "scripts/design-workers.mjs"));
  expect(await designPipelineFingerprint(first.root)).toEqual(original);
  await first.put("scripts/storybook-design-manifest.mjs", "mapping");
  expect((await designPipelineFingerprint(first.root)).hash).not.toBe(original.hash);
});

it("isolates PR signatures and restores only PR-local or main successes with the same pipeline", () => {
  expect(
    designSignatureCacheKeys({ pipelineHash: "render-v1", prNumber: "141", testedSha: "tested", baseSha: "base" }),
  ).toEqual({
    key: "design-signatures-v1-render-v1-pr-141-tested",
    previous: "design-signatures-v1-render-v1-pr-141-",
    base: "design-signatures-v1-render-v1-main-base",
    main: "design-signatures-v1-render-v1-main-",
  });
  expect(designSignatureCacheKeys({ pipelineHash: "render-v2", testedSha: "main-tested" })).toEqual({
    key: "design-signatures-v1-render-v2-main-main-tested",
    previous: "",
    base: "",
    main: "design-signatures-v1-render-v2-main-",
  });
});

it("writes CI cache keys from the same fingerprint used locally without a CI-supplied hash", async () => {
  const doc = await fixture();
  const output = join(doc.root, "github-output");
  const script = fileURLToPath(new URL("./design-pipeline.mjs", import.meta.url));
  await promisify(execFile)(process.execPath, [script, "--github-output"], {
    cwd: doc.root,
    env: { ...process.env, GITHUB_OUTPUT: output, PR_NUMBER: "141", TESTED_SHA: "tested", BASE_SHA: "base" },
  });
  const keys = Object.fromEntries(
    (await readFile(output, "utf8"))
      .trim()
      .split("\n")
      .map((line) => line.split("=")),
  );
  const { hash } = await designPipelineFingerprint(doc.root);
  expect(keys).toEqual(
    designSignatureCacheKeys({ pipelineHash: hash, prNumber: "141", testedSha: "tested", baseSha: "base" }),
  );
});

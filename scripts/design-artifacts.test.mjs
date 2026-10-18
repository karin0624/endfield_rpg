import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PNG } from "pngjs";
import { afterEach, expect, it } from "vitest";
import { prepareDesignArtifacts } from "./design-artifacts.mjs";

const temporary = [];
afterEach(async () => {
  for (const directory of temporary.splice(0)) await rm(directory, { recursive: true, force: true });
});

async function fixture(identical = false) {
  const root = await mkdtemp(join(tmpdir(), "design-artifact-test-"));
  temporary.push(root);
  const actual = new PNG({ width: 2, height: 2 });
  const reference = new PNG({ width: 2, height: 2 });
  actual.data.fill(255);
  await writeFile(join(root, "actual.png"), PNG.sync.write(actual));
  await writeFile(join(root, "reference.png"), PNG.sync.write(reference));
  const report = {
    identical,
    errors: [],
    targets: [
      {
        id: "button/default",
        comparison: { identical },
        artifacts: { implementation: "actual.png", native: "reference.png" },
      },
      {
        id: "button/disabled",
        comparison: { identical: true },
        artifacts: { implementation: "actual.png", native: "reference.png" },
      },
    ],
  };
  const path = join(root, "input.json");
  await writeFile(path, JSON.stringify(report));
  return { path, output: join(root, "output"), report };
}

it("uploads no image directory for successful comparisons", async () => {
  const { path, output } = await fixture(true);
  const summary = await prepareDesignArtifacts(path, output);
  expect(summary.failed).toEqual([]);
  await expect(readdir(output)).rejects.toMatchObject({ code: "ENOENT" });
});

it("keeps only failed cases and generates their diagnostic diff", async () => {
  const { path, output } = await fixture();
  const result = await prepareDesignArtifacts(path, output);
  expect(result.images.map((image) => image.id)).toEqual(["button/default"]);
  expect((await readdir(output)).sort()).toEqual([
    "0000.diff.png",
    "0000.implementation.png",
    "0000.reference.png",
    "report.json",
  ]);
  const diff = PNG.sync.read(await readFile(join(output, "0000.diff.png")));
  expect([...diff.data]).toEqual(Array(16).fill(255));
});

it("bounds image bytes while retaining all failure identities and render errors", async () => {
  const { path, output, report } = await fixture();
  report.errors.push("Renderer failed");
  report.targets.push({ id: "card/loading", error: "Font missing" });
  await writeFile(path, JSON.stringify(report));
  const result = await prepareDesignArtifacts(path, output, 1);
  expect(result.imageBytes).toBe(0);
  expect(result.omitted).toEqual(["button/default"]);
  expect(result.failed.map((entry) => entry.id)).toEqual(["button/default", "card/loading"]);
  expect(result.errors).toEqual(["Renderer failed"]);
  expect(await readdir(output)).toEqual(["report.json"]);
});

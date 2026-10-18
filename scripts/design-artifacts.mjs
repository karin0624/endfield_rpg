import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { PNG } from "pngjs";

export const DESIGN_ARTIFACT_LIMIT = 20 * 1024 * 1024;

/** Diagnostic images are temporary failure evidence, never accepted reference images. */
export async function prepareDesignArtifacts(reportPath, destination, limit = DESIGN_ARTIFACT_LIMIT) {
  const report = JSON.parse(await readFile(reportPath, "utf8"));
  await rm(destination, { recursive: true, force: true });
  const failed = (report.targets ?? []).filter((target) => target.error || !target.comparison?.identical);
  const summary = {
    document: report.document,
    inputSHA256: report.inputSHA256,
    bindingsSHA256: report.bindingsSHA256,
    scope: report.scope,
    complete: report.complete,
    identical: report.identical,
    errors: report.errors ?? [],
    environment: report.environment,
    failed: failed.map(({ id, error, comparison, storyId, figma }) => ({ id, error, comparison, storyId, figma })),
    images: [],
    omitted: [],
    limit,
  };
  if (report.identical && !summary.errors.length) return summary;
  await mkdir(destination, { recursive: true });
  let bytes = 0;
  const source = dirname(resolve(reportPath));
  for (const [index, target] of failed.entries()) {
    const implementation = target.artifacts?.implementation;
    const reference = target.artifacts?.native;
    if (!implementation || !reference) continue;
    const actualPath = join(source, implementation);
    const referencePath = join(source, reference);
    const actualBytes = await readFile(actualPath);
    const referenceBytes = await readFile(referencePath);
    if (bytes + actualBytes.length + referenceBytes.length > limit) {
      summary.omitted.push(target.id);
      continue;
    }
    const actual = PNG.sync.read(actualBytes);
    const expected = PNG.sync.read(referenceBytes);
    const diff = new PNG({
      width: Math.max(actual.width, expected.width),
      height: Math.max(actual.height, expected.height),
    });
    for (let y = 0; y < diff.height; y++)
      for (let x = 0; x < diff.width; x++) {
        const output = (y * diff.width + x) * 4;
        for (let channel = 0; channel < 4; channel++) {
          const a = x < actual.width && y < actual.height ? actual.data[(y * actual.width + x) * 4 + channel] : 0;
          const b =
            x < expected.width && y < expected.height ? expected.data[(y * expected.width + x) * 4 + channel] : 0;
          diff.data[output + channel] = channel === 3 ? 255 : Math.abs(a - b);
        }
      }
    const diffBytes = PNG.sync.write(diff);
    const size = actualBytes.length + referenceBytes.length + diffBytes.length;
    if (bytes + size > limit) {
      summary.omitted.push(target.id);
      continue;
    }
    const prefix = String(index).padStart(4, "0");
    await cp(actualPath, join(destination, `${prefix}.implementation.png`));
    await cp(referencePath, join(destination, `${prefix}.reference.png`));
    await writeFile(join(destination, `${prefix}.diff.png`), diffBytes);
    bytes += size;
    summary.images.push({
      id: target.id,
      prefix,
      bytes: size,
      reproduce: `npm run openpencil:verify -- --select ${target.id}`,
    });
  }
  summary.imageBytes = bytes;
  await writeFile(join(destination, "report.json"), `${JSON.stringify(summary, null, 2)}\n`);
  return summary;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [report, output = "test-results/design-failures"] = process.argv.slice(2);
  if (!report) throw new Error("Usage: design-artifacts REPORT.json [OUTPUT]");
  const summary = await prepareDesignArtifacts(report, output);
  process.stdout.write(
    `${JSON.stringify({ failures: summary.failed.length, imageBytes: summary.imageBytes ?? 0, omitted: summary.omitted.length })}\n`,
  );
}

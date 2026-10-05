import { readFile, rm } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { CoverageReport } from "monocart-coverage-reports";
import { compile } from "svelte/compiler";
import { transformWithOxc } from "vite";

const ownSource = (path) =>
  path.startsWith("src/") &&
  (path.endsWith(".ts") || path.endsWith(".svelte")) &&
  !path.endsWith(".test.ts") &&
  !path.endsWith(".d.ts");

export function browserCoverage(project, config) {
  if (!config.projects.some((item) => item.name === project)) throw new Error(`Unknown coverage project: ${project}`);
  return new CoverageReport({
    name: `Browser execution: ${project}`,
    outputDir: `coverage/browser/${project}`,
    reports: ["html", "json", "json-summary", "lcovonly"],
    sourcePath(filePath, info = {}) {
      let path = filePath;
      if (!path.includes("/") && info.distFile) path = `${dirname(info.distFile)}/${path}`;
      if (path.includes("node_modules")) return path;
      const index = path.indexOf("src/");
      return index < 0 ? path : path.slice(index);
    },
    sourceFilter: ownSource,
    all: {
      dir: resolve("src"),
      filter: (path) =>
        (path.endsWith(".ts") || path.endsWith(".svelte")) && !path.endsWith(".test.ts") && !path.endsWith(".d.ts"),
      async transformer(entry) {
        const transformed = entry.url.endsWith(".svelte")
          ? compile(entry.source, { filename: entry.url, generate: "client", dev: false }).js
          : await transformWithOxc(entry.source, basename(entry.url), { sourcemap: true });
        entry.source = transformed.code;
        entry.sourceMap = transformed.map;
      },
    },
  });
}

// Keep revision.txt and the independent Vitest report intact.
export async function setupBrowserCoverage() {
  await rm("coverage/browser", { recursive: true, force: true });
}

export async function finishBrowserCoverage(config) {
  for (const { name: project } of config.projects) {
    const report = browserCoverage(project, config);
    if (!report.hasCache()) throw new Error(`No executed browser coverage for ${project}`);
    await report.generate();
    const summary = JSON.parse(await readFile(`coverage/browser/${project}/coverage-summary.json`, "utf8"));
    if (!summary.total?.lines?.covered) throw new Error(`No mapped application source executed in ${project}`);
  }
}

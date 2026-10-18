import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { compareDesignSnapshots, createDesignSnapshot, DESIGN_SNAPSHOT_VERSION } from "./design-diff.mjs";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const modulePath = (path) => path.replaceAll("\\", "/").replace(/^\.\//, "");

// Only the standard SFNT name table is needed to associate bundled TTF bytes with
// the same family names the graph uses. This does not load or render a font.
function fontFamilies(bytes) {
  const tables = bytes.readUInt16BE(4);
  let nameTable;
  for (let index = 0; index < tables; index++) {
    const offset = 12 + index * 16;
    if (bytes.toString("ascii", offset, offset + 4) === "name") nameTable = bytes.readUInt32BE(offset + 8);
  }
  if (nameTable === undefined) throw new Error("Bundled TTF has no name table");
  const count = bytes.readUInt16BE(nameTable + 2);
  const strings = nameTable + bytes.readUInt16BE(nameTable + 4);
  const families = new Set();
  for (let index = 0; index < count; index++) {
    const record = nameTable + 6 + index * 12;
    const platform = bytes.readUInt16BE(record);
    const name = bytes.readUInt16BE(record + 6);
    if (![1, 16].includes(name) || ![0, 1, 3].includes(platform)) continue;
    const length = bytes.readUInt16BE(record + 8);
    const offset = strings + bytes.readUInt16BE(record + 10);
    const value = bytes.subarray(offset, offset + length);
    if (offset + length > bytes.length) throw new Error("Bundled TTF has a truncated name table");
    const family = platform === 1 ? value.toString("latin1") : Buffer.from(value).swap16().toString("utf16le");
    if (family) families.add(family);
  }
  if (!families.size) throw new Error("Bundled TTF has no family name");
  return [...families];
}

async function bundledFontHashes(root) {
  const directory = join(root, "art-src/openpencil/fonts");
  const fonts = {};
  for (const name of (await readdir(directory)).filter((name) => name.toLowerCase().endsWith(".ttf")).sort()) {
    const bytes = await readFile(join(directory, name));
    const hash = sha256(bytes);
    for (const family of fontFamilies(bytes)) {
      fonts[family] ??= [];
      fonts[family].push([name, hash]);
    }
  }
  return fonts;
}

async function previousSnapshot(path) {
  let bytes;
  try {
    bytes = await readFile(path, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return { reason: "missing" };
    throw error;
  }
  let snapshot;
  try {
    snapshot = JSON.parse(bytes);
  } catch (error) {
    if (error instanceof SyntaxError) return { reason: "invalid-json" };
    throw error;
  }
  if (snapshot.version !== DESIGN_SNAPSHOT_VERSION || !snapshot.targets) return { reason: "incompatible" };
  if (snapshot.verified !== true) return { reason: "unverified" };
  return { snapshot, reason: "verified" };
}

/**
 * Resolve change selection from public Storybook/Vite indexes and disposable JSON
 * signatures. The caller owns rendering, result collection, and saving a verified
 * snapshot. An explicit --select must never advance the shared verified baseline.
 */
export async function prepareDesignSelection({
  graph,
  manifest,
  storybookDirectory,
  snapshotPath = ".openpencil/verification/verified-inputs.json",
  environment = {},
  select = [],
  changed = false,
  diffOnly = false,
  root = process.cwd(),
  resourceFiles,
}) {
  const directory = resolve(root, storybookDirectory);
  const [index, dependencies, fonts, previous] = await Promise.all([
    readFile(join(directory, "index.json"), "utf8").then(JSON.parse),
    readFile(join(directory, "design-dependencies.json"), "utf8").then(JSON.parse),
    bundledFontHashes(root),
    previousSnapshot(resolve(root, snapshotPath)),
  ]);
  if (dependencies.version !== 1 || !dependencies.stories)
    throw new Error("Unsupported Storybook design dependency index");
  const resources = resourceFiles ?? previous.snapshot?.resourceFiles ?? {};
  const implementationDependencies = {};
  for (const target of manifest.targets) {
    const story = index.entries?.[target.storyId];
    if (story?.type !== "story") throw new Error(`${target.id}: missing Storybook story ${target.storyId}`);
    const file = modulePath(story.importPath);
    const files = dependencies.stories[file];
    if (!Array.isArray(files) || !files.length)
      throw new Error(`${target.id}: missing resolved Vite dependencies for ${file}`);
    implementationDependencies[target.id] = [
      ...new Set([target.source, file, ...files, ...(resources[target.id] ?? [])].filter(Boolean).map(modulePath)),
    ].sort();
  }
  const files = [...new Set(Object.values(implementationDependencies).flat())];
  const fileHashes = Object.fromEntries(
    await Promise.all(
      files.map(async (file) => {
        try {
          return [file, sha256(await readFile(resolve(root, file)))];
        } catch (error) {
          // A deleted resource is a changed input too. Re-rendering either records its
          // replacement or reports the real missing-resource failure.
          if (error.code === "ENOENT") return [file, null];
          throw error;
        }
      }),
    ),
  );
  const snapshot = createDesignSnapshot(graph, manifest, {
    environment,
    fontFiles: fonts,
    implementationDependencies,
    fileHashes,
  });
  snapshot.verified = false;
  snapshot.resourceFiles = Object.fromEntries(
    manifest.targets.map((target) => [target.id, [...new Set((resources[target.id] ?? []).map(modulePath))].sort()]),
  );
  const changes = compareDesignSnapshots(previous.snapshot, snapshot);
  const all = manifest.targets.map((target) => target.id);
  const requested = new Set(select);
  for (const id of requested) if (!all.includes(id)) throw new Error(`Unknown selected target: ${id}`);
  const scope = requested.size ? "selected" : changed || diffOnly ? "changed" : "all";
  return {
    snapshot,
    fileHashes,
    selectedTargetIds:
      scope === "selected" ? all.filter((id) => requested.has(id)) : scope === "changed" ? changes.selected : all,
    scope,
    changes,
    unchangedCount: all.length - changes.selected.length,
    baseline: { path: resolve(root, snapshotPath), available: !!previous.snapshot, reason: previous.reason },
  };
}

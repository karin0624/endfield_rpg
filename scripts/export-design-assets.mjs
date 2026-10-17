import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, posix, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { resolveFigmaNode } from "./verify-design-bindings.mjs";

/** Export registered SVG artwork through the ordinary native SVG exporter. */
export async function exportDesignAssets(
  source,
  { bindings = "art-src/openpencil/bindings.json", output = process.cwd() } = {},
) {
  const manifest = JSON.parse(await readFile(resolve(bindings), "utf8"));
  const input = await readFile(resolve(manifest.document));
  const { parseFigFile, svgFormat } = await import(
    pathToFileURL(join(resolve(source), "packages/core/dist/index.js")).href
  );
  const graph = await parseFigFile(input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength), {
    populate: "all",
  });
  const assets = [];
  const names = new Set();
  for (const component of manifest.components ?? []) {
    const filename = component.source;
    if (typeof filename !== "string" || !filename.endsWith(".svg")) continue;
    if (!filename.startsWith("public/assets/") || posix.normalize(filename) !== filename || filename.includes("\\"))
      throw new Error(`SVG asset must use a project-relative public/assets path: ${filename}`);
    if (names.has(filename) || component.nodes.length !== 1)
      throw new Error(`SVG asset must have one registered main and one output: ${filename}`);
    names.add(filename);
    const main = resolveFigmaNode(graph, component.nodes[0]);
    if (main.type !== "COMPONENT" || !main.exportSettings.some((setting) => setting.format === "svg"))
      throw new Error(`SVG asset requires an ordinary component with an SVG export preset: ${filename}`);
    const options = component.svgExport ?? { preserveAspectRatio: "none" };
    if (
      !options ||
      typeof options !== "object" ||
      Object.keys(options).some((key) => key !== "preserveAspectRatio") ||
      !["none", "xMidYMid meet"].includes(options.preserveAspectRatio)
    )
      throw new Error(`SVG asset requires a supported preserveAspectRatio export option: ${filename}`);
    const exported = await svgFormat.exportContent(
      { graph, target: { scope: "node", nodeId: main.id } },
      { precision: null, xmlDeclaration: false, ...options },
    );
    if (typeof exported.data !== "string" || exported.assets?.length)
      throw new Error(`Expected one standalone SVG artifact: ${filename}`);
    assets.push({
      component: component.id,
      filename,
      svgExport: options,
      bytes: Buffer.byteLength(exported.data),
      sha256: createHash("sha256").update(exported.data).digest("hex"),
      data: exported.data,
    });
  }
  if (!assets.length) throw new Error("No registered SVG artwork exports in this design document");
  // Validate every artifact before writing. The SVG bytes are used unchanged.
  for (const asset of assets) {
    const path = resolve(output, asset.filename);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, asset.data);
  }
  return {
    document: manifest.document,
    inputSHA256: createHash("sha256").update(input).digest("hex"),
    output: resolve(output),
    assets: assets.map(({ data: _data, ...asset }) => asset),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [source, ...args] = process.argv.slice(2);
  const { values, positionals } = parseArgs({
    args,
    options: { bindings: { type: "string" }, output: { type: "string" } },
  });
  if (!source || positionals.length)
    throw new Error("Usage: export-design-assets SOURCE [--bindings FILE] [--output DIR]");
  process.stdout.write(`${JSON.stringify(await exportDesignAssets(source, values), null, 2)}\n`);
}

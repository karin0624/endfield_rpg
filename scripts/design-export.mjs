import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  resolveCaptureSource,
  resolveFigmaNode,
  resolveNativeInteractions,
  setComponentProperties,
  setNestedComponentProperties,
  writeSharedExport,
} from "./verify-design-bindings.mjs";

// Each process owns its graph, font caches and temporary instances. Parallel
// exports never mutate another target's component or depend on implementation DOM.
const [source, directory, jobFile] = process.argv.slice(2);
const { document, jobs } = JSON.parse(await readFile(join(directory, `${jobFile}.json`), "utf8"));
const started = performance.now();
const { parseFigFile, FigmaAPI, fontManager, htmlFormat } = await import(
  pathToFileURL(join(resolve(source), "packages/core/dist/index.js")).href
);
const input = await readFile(document);
const graph = await parseFigFile(input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength), {
  populate: "all",
});
const api = new FigmaAPI(graph);
const roots = new Set(
  jobs.map(({ target }) => {
    const node = resolveCaptureSource(graph, target);
    const parent = graph.getNode(node.parentId);
    return parent?.type === "COMPONENT_SET" ? parent.id : node.id;
  }),
);
for (const [family, style] of fontManager.collectFontKeys(graph, [...roots]))
  if (!(await fontManager.loadFont(family, style))) throw new Error(`Cannot load font ${family} / ${style}`);
const assets = new Map();
for (const job of jobs) {
  const { target } = job;
  const original = resolveCaptureSource(graph, target);
  const framePadding = target.renderFrame?.padding ?? 32;
  if (typeof framePadding !== "number" || !Number.isFinite(framePadding) || framePadding < 0)
    throw new Error(`Story frame padding must use nonnegative pixels: ${target.id}`);
  const wrapper = graph.createNode("FRAME", graph.getPages()[0].id, {
    name: `Verification/${target.id}`,
    x: 0,
    y: 0,
    width: target.viewport.width,
    height: target.viewport.height,
    fills: [],
    clipsContent: false,
  });
  try {
    const position = target.kind === "component" ? { x: framePadding, y: framePadding } : { x: 0, y: 0 };
    const instance =
      original.type === "COMPONENT"
        ? graph.createInstance(original.id, wrapper.id, position)
        : graph.cloneTree(original.id, wrapper.id, position);
    if (!instance) throw new Error(`Cannot instantiate Figma node: ${target.id}`);
    if (["COMPONENT", "INSTANCE"].includes(original.type)) {
      const node = api.wrapNode(instance.id);
      setComponentProperties(node, target.figma.properties, graph);
      setNestedComponentProperties(node, target.figma.nestedProperties, graph);
    }
    const current = graph.getNode(instance.id);
    graph.updateNode(current.id, position);
    if (![current.width, current.height].every((value) => Number.isFinite(value) && value > 0))
      throw new Error(`Figma target must have positive dimensions: ${target.id}`);
    if (
      target.kind === "screen" &&
      (current.width !== target.viewport.width || current.height !== target.viewport.height)
    )
      throw new Error(`Screen frame must equal its viewport: ${target.id}`);
    const exported = await htmlFormat.exportContent(
      {
        graph,
        target: { scope: "node", nodeId: target.kind === "screen" ? current.id : wrapper.id },
        fileName: "frame.html",
      },
      { html: "standalone", style: "inline", assets: "external", fonts: "assets", lang: "ja" },
    );
    await writeSharedExport(exported, join(directory, "reference"), `${job.name}.html`, assets);
    job.resolvedNodeId = resolveFigmaNode(graph, target.figma).id;
    job.nativeNodeId = current.id;
    job.nativeInteractions = target.figma.interactions
      ? resolveNativeInteractions(original, current, target.figma.interactions, graph)
      : [];
  } finally {
    graph.deleteNode(wrapper.id);
  }
}
await writeFile(
  join(directory, `${jobFile}.export.json`),
  JSON.stringify({ jobs, seconds: (performance.now() - started) / 1000 }),
);

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, posix, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { comparePNG } from "./compare-png.mjs";

const [source, ...args] = process.argv.slice(2);
const { values, positionals } = parseArgs({
  args,
  allowPositionals: true,
  options: {
    page: { type: "string" },
    node: { type: "string" },
    output: { type: "string" },
    compare: { type: "string" },
    lang: { type: "string", default: "ja" },
    container: { type: "string" },
    "container-root": { type: "string", default: "/work" },
    "verify-home": { type: "boolean", default: false },
  },
});
if (positionals.length !== 1 || !values.page || !values.node || !values.output) {
  throw new Error(
    "Usage: openpencil:render INPUT.fig --page NAME --node NAME --output FILE.png [--compare FILE.png] [--lang ja] [--container NAME] [--container-root /work]",
  );
}
const project = process.cwd();
if (!posix.isAbsolute(values["container-root"])) throw new Error("Container root must be an absolute Linux path");
const browserRoot = posix.normalize(values["container-root"]);
const { parseFigFile, htmlFormat, fontManager } = await import(
  pathToFileURL(join(source, "packages/core/dist/index.js")).href
);
const input = await readFile(resolve(positionals[0]));
const graph = await parseFigFile(input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength), {
  populate: "all",
});
const pages = graph.getPages().filter((page) => page.name === values.page);
if (pages.length !== 1) throw new Error(`Expected one page named ${values.page}; found ${pages.length}`);
const nodes = graph.getChildren(pages[0].id).filter((node) => node.name === values.node && node.visible);
if (nodes.length !== 1) throw new Error(`Expected one visible node named ${values.node}; found ${nodes.length}`);
const node = nodes[0];
for (const [family, style] of fontManager.collectFontKeys(graph, [node.id])) {
  if (!(await fontManager.loadFont(family, style))) throw new Error(`Cannot load font ${family} / ${style}`);
}
// A node export starts at its own origin even when the frame moves on its page.
graph.updateNode(node.id, { x: 0, y: 0 });
const width = Math.ceil(node.width),
  height = Math.ceil(node.height);
if (!(width > 0 && height > 0)) throw new Error("The exported node must have positive dimensions");
const exported = await htmlFormat.exportContent(
  { graph, target: { scope: "node", nodeId: node.id }, fileName: "frame.html" },
  { html: "standalone", style: "inline", assets: "inline", fonts: "assets", lang: values.lang },
);
const temporary = await mkdtemp(join(project, ".openpencil/render-"));
try {
  await writeFile(join(temporary, "frame.html"), exported.data);
  for (const asset of exported.assets ?? []) {
    const path = join(temporary, asset.path);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, asset.content);
  }
  await writeFile(join(temporary, "job.json"), JSON.stringify({ width, height, verifyHome: values["verify-home"] }));
  const browserCommand = [
    "node",
    posix.join(browserRoot, "scripts/render-openpencil-html.mjs"),
    posix.join(browserRoot, relative(project, temporary).split(sep).join("/")),
  ];
  await new Promise((resolveRun, reject) => {
    const child = spawn(
      "docker",
      values.container
        ? [
            "exec",
            "--user",
            `${process.getuid()}:${process.getgid()}`,
            "-w",
            browserRoot,
            values.container,
            ...browserCommand,
          ]
        : [
            "run",
            "--rm",
            "--init",
            "--ipc=host",
            "--user",
            `${process.getuid()}:${process.getgid()}`,
            "-v",
            `${project}:${browserRoot}`,
            "-w",
            browserRoot,
            "mcr.microsoft.com/playwright:v1.63.0-noble",
            ...browserCommand,
          ],
      { stdio: "inherit" },
    );
    child.on("error", reject);
    child.on("exit", (code, signal) =>
      code === 0 ? resolveRun() : reject(new Error(`Browser renderer exited with ${signal ?? code}`)),
    );
  });
  const output = resolve(values.output);
  await mkdir(dirname(output), { recursive: true });
  await cp(join(temporary, "result.png"), output);
  const result = {
    inputSHA256: createHash("sha256").update(input).digest("hex"),
    node: node.id,
    width,
    height,
    output,
    ...JSON.parse(await readFile(join(temporary, "result.json"), "utf8")),
  };
  if (values.compare) {
    result.comparison = await comparePNG(output, resolve(values.compare));
    if (!result.comparison.identical) process.exitCode = 1;
  }
  if (values["verify-home"]) {
    const implementation = output.replace(/(\.png)?$/, ".implementation.png");
    await cp(join(temporary, "implementation.png"), implementation);
    result.homeComparison = await comparePNG(implementation, output);
    if (!result.homeComparison.identical) process.exitCode = 1;
  }
  await writeFile(`${output}.json`, `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} finally {
  await rm(temporary, { recursive: true, force: true });
}

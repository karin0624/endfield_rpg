import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { SourceMap } from "node:module";
import { basename, resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { chromium } from "@playwright/test";
import { observeWebGLResources, webGLResources } from "../tests/browser/webglResources.ts";

if (!process.argv[2]) throw new Error("Usage: node scripts/measure-view.mjs output-directory [base-url] [repeats]");
const directory = resolve(process.argv[2]);
const base = process.argv[3] ?? "http://127.0.0.1:4174";
const repeats = Number(process.argv[4] ?? 3);
await mkdir(directory, { recursive: true });
const quantiles = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    count: sorted.length,
    p50: sorted[Math.floor(sorted.length * 0.5)] ?? 0,
    p95: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
    sum: values.reduce((a, b) => a + b, 0),
  };
};
function summarizeTrace(events) {
  const starts = events.filter((event) => event.name === "view-workload-start");
  const start = starts.at(-1)?.ts;
  const end = events.findLast((event) => event.name === "view-workload-end")?.ts;
  if (start === undefined || end === undefined) throw new Error("Missing workload trace boundaries");
  const main = events.find((event) => event.name === "thread_name" && event.args?.name === "CrRendererMain");
  if (!main) throw new Error("Missing renderer main thread");
  const tasks = events.filter(
    (event) =>
      event.ph === "X" &&
      event.name === "RunTask" &&
      event.pid === main.pid &&
      event.tid === main.tid &&
      event.ts < end &&
      event.ts + event.dur > start,
  );
  const markers = events
    .filter((event) => /^view-frame-\d+$/.test(event.name) && event.ts >= start && event.ts < end)
    .sort((a, b) => a.ts - b.ts);
  if (!tasks.length || markers.length !== 180)
    throw new Error(`Incomplete frame trace: ${tasks.length} tasks / ${markers.length} frames`);
  const frameCpu = markers.map((marker, index) => {
    const stop = markers[index + 1]?.ts ?? end;
    return (
      tasks.reduce(
        (sum, task) => sum + Math.max(0, Math.min(stop, task.ts + task.dur) - Math.max(marker.ts, task.ts)),
        0,
      ) / 1000
    );
  });
  const totals = {};
  for (const name of ["UpdateLayoutTree", "Layout", "Paint", "RasterTask", "MinorGC", "MajorGC"]) {
    const samples = events.filter(
      (event) => event.ph === "X" && event.name === name && event.ts >= start && event.ts < end,
    );
    totals[name] = { count: samples.length, totalMs: samples.reduce((sum, event) => sum + event.dur, 0) / 1000 };
  }
  return { mainTaskPerFrameMs: quantiles(frameCpu), phases: totals };
}
// Standard build maps let a sampled profile include projection and renderer costs
// without adding product instrumentation. Sampling is an estimate, not call counting.
const maps = new Map();
for (const name of await readdir("dist-views/assets")) {
  if (name.endsWith(".js.map"))
    maps.set(name.slice(0, -4), new SourceMap(JSON.parse(await readFile(`dist-views/assets/${name}`, "utf8"))));
}
function summarizeProfile(profile) {
  const nodes = new Map(profile.nodes.map((node) => [node.id, node]));
  const parents = new Map(profile.nodes.flatMap((node) => (node.children ?? []).map((child) => [child, node.id])));
  const source = (node) => {
    const map = maps.get(basename(node.callFrame.url));
    return map?.findEntry(node.callFrame.lineNumber, node.callFrame.columnNumber).originalSource ?? node.callFrame.url;
  };
  const totals = { projectionInclusiveMs: 0, browserViewInclusiveMs: 0, babylonInclusiveMs: 0, gcSampleMs: 0 };
  for (const [index, id] of profile.samples.entries()) {
    const chain = [];
    for (let current = id; current !== undefined; current = parents.get(current)) chain.push(nodes.get(current));
    const paths = chain.map(source);
    const weight = profile.timeDeltas[index] / 1000;
    if (paths.some((path) => /src\/presentation\/.*(?:Projection|Geometry|Placement)\.ts/.test(path)))
      totals.projectionInclusiveMs += weight;
    if (paths.some((path) => path.includes("src/web/") && !path.includes("battleScene")))
      totals.browserViewInclusiveMs += weight;
    if (paths.some((path) => path.includes("@babylonjs"))) totals.babylonInclusiveMs += weight;
    if (chain.some((node) => node.callFrame.functionName === "(garbage collector)")) totals.gcSampleMs += weight;
  }
  return totals;
}
const browser = await chromium.launch({ headless: true, args: ["--enable-unsafe-swiftshader"] });
const output = {
  browser: browser.version(),
  viewport: { width: 1440, height: 1080 },
  dpr: 1,
  graphics: "fixed Playwright image; SwiftShader software WebGL",
  runs: [],
};
try {
  for (let repeat = 0; repeat < repeats; repeat++) {
    for (const workload of ["battle", "marker", "cue", "switch"]) {
      const context = await browser.newContext({
        viewport: output.viewport,
        deviceScaleFactor: 1,
        reducedMotion: "no-preference",
      });
      const page = await context.newPage();
      await observeWebGLResources(page);
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`${base}/rpg/tests/fixtures/performance-view.html`);
      await page.waitForSelector("#app[data-measure-ready]", { state: "attached" });
      const session = await context.newCDPSession(page);
      await session.send("Performance.enable");
      const running = page.evaluate(({ workload }) => window.measureView(workload, 180, true), { workload });
      await page.waitForSelector("#app[data-profiler-ready]", { state: "attached", timeout: 60000 });
      await session.send("HeapProfiler.collectGarbage");
      const before = await session.send("Performance.getMetrics");
      await session.send("Profiler.enable");
      await session.send("Profiler.setSamplingInterval", { interval: 1000 });
      await session.send("Profiler.start");
      await session.send("HeapProfiler.startSampling", {
        samplingInterval: 16384,
        includeObjectsCollectedByMajorGC: true,
        includeObjectsCollectedByMinorGC: true,
      });
      const events = [];
      session.on("Tracing.dataCollected", ({ value }) => events.push(...value));
      await session.send("Tracing.start", {
        categories:
          "toplevel,devtools.timeline,blink.user_timing,v8,disabled-by-default-v8.gc,disabled-by-default-devtools.timeline",
        transferMode: "ReportEvents",
      });
      await page.evaluate(() => window.beginMeasurement());
      const frame = await running;
      const sampled = await session.send("HeapProfiler.stopSampling");
      const { profile } = await session.send("Profiler.stop");
      const complete = new Promise((resolveDone) => session.once("Tracing.tracingComplete", resolveDone));
      await session.send("Tracing.end");
      await complete;
      await page.waitForFunction(
        () =>
          ["Buffer", "Texture", "Program"].every(
            (kind) =>
              performance.getEntriesByName(`webgl-create-${kind}`).length ===
              performance.getEntriesByName(`webgl-delete-${kind}`).length,
          ),
        undefined,
        { timeout: 60000 },
      );
      const resources = await webGLResources(page);
      await session.send("HeapProfiler.collectGarbage");
      const after = await session.send("Performance.getMetrics");
      const allocation = (node) => node.selfSize + node.children.reduce((sum, child) => sum + allocation(child), 0);
      const result = {
        repeat,
        ...frame,
        trace: summarizeTrace(events),
        sampledCpu: summarizeProfile(profile),
        sampledAllocationBytes: allocation(sampled.profile.head),
        metricsBefore: Object.fromEntries(before.metrics.map(({ name, value }) => [name, value])),
        metricsAfterGc: Object.fromEntries(after.metrics.map(({ name, value }) => [name, value])),
        resourcesAfterExit: resources,
        errors,
      };
      if (errors.length || Object.values(resources).some((count) => count !== 0))
        throw new Error(JSON.stringify({ workload, errors, resources }));
      output.runs.push(result);
      await writeFile(resolve(directory, `${repeat}-${workload}-cpu.json`), JSON.stringify(profile));
      await writeFile(resolve(directory, `${repeat}-${workload}-trace.json`), JSON.stringify({ traceEvents: events }));
      await writeFile(resolve(directory, "results.json"), JSON.stringify(output, null, 2));
      process.stdout.write(
        `${repeat} ${workload}: apply p95 ${frame.applyWallMs.p95.toFixed(3)} ms, main task p95 ${result.trace.mainTaskPerFrameMs.p95.toFixed(3)} ms\n`,
      );
      await context.close();
    }
  }
  const bundles = [];
  for (const name of await readdir("dist/assets")) {
    if (!name.endsWith(".js")) continue;
    const bytes = await readFile(`dist/assets/${name}`);
    bundles.push({ name, bytes: bytes.length, gzipBytes: gzipSync(bytes).length });
  }
  output.bundle = {
    files: bundles.length,
    bytes: bundles.reduce((sum, file) => sum + file.bytes, 0),
    gzipBytes: bundles.reduce((sum, file) => sum + file.gzipBytes, 0),
  };
  await writeFile(resolve(directory, "results.json"), JSON.stringify(output, null, 2));
} finally {
  await browser.close();
}

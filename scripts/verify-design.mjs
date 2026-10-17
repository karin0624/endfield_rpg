import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { access, cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, posix, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { build } from "vite";
import { comparePNG } from "./compare-png.mjs";
import {
  assertCompositeCoverage,
  clearCaptureBoundary,
  DESIGN_BROWSER_ARGS,
  DESIGN_BROWSER_SCREEN,
  designBrowserCapture,
  nativeCapturePlacement,
  nativeSizing,
  observeCompositeProperties,
  resolveCaptureSource,
  resolveCompositeClone,
  resolveCompositeComponent,
  resolveFigmaNode,
  resolveNativeInteractions,
  resolveNativeScroll,
  setComponentProperties,
  setNestedComponentProperties,
  validateBindings,
  writeSharedExport,
} from "./verify-design-bindings.mjs";

const image = "mcr.microsoft.com/playwright:v1.63.0-noble";
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function run(command, args) {
  await new Promise((complete, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code, signal) =>
      code === 0 ? complete() : reject(new Error(`${command} exited with ${signal ?? code}`)),
    );
  });
}

export async function verifyDesign(
  source,
  {
    bindings = "art-src/openpencil/bindings.json",
    output = "test-results/openpencil/verification",
    select = [],
    container,
    containerRoot = "/work",
    keepExport = false,
  } = {},
) {
  const project = process.cwd();
  if (!posix.isAbsolute(containerRoot)) throw new Error("Container root must be an absolute Linux path");
  const browserRoot = posix.normalize(containerRoot);
  const destination = resolve(output);
  await mkdir(destination, { recursive: true });
  const bindingBytes = await readFile(resolve(bindings));
  const manifest = JSON.parse(bindingBytes);
  const input = await readFile(resolve(manifest.document));
  const { parseFigFile, FigmaAPI, fontManager, htmlFormat } = await import(
    pathToFileURL(join(resolve(source), "packages/core/dist/index.js")).href
  );
  const graph = await parseFigFile(input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength), {
    populate: "all",
  });
  const selected = new Set(select);
  const report = {
    document: manifest.document,
    inputSHA256: sha256(input),
    bindingsSHA256: sha256(bindingBytes),
    environment: {
      image,
      deviceScaleFactor: 1,
      browserArgs: DESIGN_BROWSER_ARGS,
      screen: DESIGN_BROWSER_SCREEN,
      paintInitialization: "chromium-full-repaint",
    },
    scope: selected.size === 0 ? "all" : "selected",
    complete: false,
    identical: false,
    errors: validateBindings(manifest, graph, { complete: selected.size === 0 }),
    targets: [],
  };
  const targets = (Array.isArray(manifest.targets) ? manifest.targets : []).filter(
    (target) => selected.size === 0 || selected.has(target.id),
  );
  for (const id of selected)
    if (!targets.some((target) => target.id === id)) report.errors.push(`Unknown selected target: ${id}`);
  const saveReport = () => writeFile(join(destination, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  if (report.errors.length) {
    await saveReport();
    return report;
  }
  for (const sourcePath of new Set([
    ...(manifest.components ?? []).map((component) => component.source),
    ...targets.map((target) => target.source).filter(Boolean),
  ])) {
    try {
      await access(resolve(sourcePath));
    } catch {
      report.errors.push(`Missing implementation source: ${sourcePath}`);
    }
  }
  if (report.errors.length) {
    await saveReport();
    return report;
  }
  const workspace = join(project, ".openpencil/verification");
  await mkdir(workspace, { recursive: true });
  const temporary = await mkdtemp(join(workspace, "verify-"));
  if (keepExport) report.exportDirectory = temporary;
  const references = join(temporary, "reference");
  await mkdir(references);
  const api = new FigmaAPI(graph);
  const writtenAssets = new Map();
  const jobs = targets.map((target, index) => ({
    name: String(index).padStart(4, "0"),
    target,
    padding: target.kind === "component" ? (target.capture?.padding ?? 16) : 0,
  }));
  let browserContainer = container;
  let ownsBrowserContainer = false;
  const capture = async (mode) => {
    await writeFile(join(temporary, "job.json"), JSON.stringify({ mode, jobs }));
    const browserDirectory = posix.join(browserRoot, relative(project, temporary).split(sep).join("/"));
    const command = [
      ...(targets.some((target) => !designBrowserCapture(target).headless)
        ? ["xvfb-run", "-a", "-s", `-screen 0 ${DESIGN_BROWSER_SCREEN.width}x${DESIGN_BROWSER_SCREEN.height}x24`]
        : []),
      "node",
      posix.join(browserRoot, "scripts/verify-design-browser.mjs"),
      browserDirectory,
    ];
    if (!browserContainer) {
      browserContainer = `endfield-design-${process.pid}-${sha256(temporary).slice(0, 12)}`;
      await run("docker", [
        "run",
        "--detach",
        "--rm",
        "--init",
        "--ipc=host",
        "--name",
        browserContainer,
        "--user",
        `${process.getuid()}:${process.getgid()}`,
        "-v",
        `${project}:${browserRoot}`,
        "-w",
        browserRoot,
        image,
        "node",
        "-e",
        "setInterval(() => {}, 60000)",
      ]);
      ownsBrowserContainer = true;
    }
    await run("docker", [
      "exec",
      "--user",
      `${process.getuid()}:${process.getgid()}`,
      "-w",
      browserRoot,
      browserContainer,
      ...command,
    ]);
    return JSON.parse(await readFile(join(temporary, mode === "actual" ? "actual.json" : "browser.json"), "utf8"));
  };
  try {
    const fontRoots = new Set(
      targets.map((target) => {
        const node = resolveCaptureSource(graph, target);
        const parent = graph.getNode(node.parentId);
        return parent?.type === "COMPONENT_SET" ? parent.id : node.id;
      }),
    );
    for (const [family, style] of fontManager.collectFontKeys(graph, [...fontRoots]))
      if (!(await fontManager.loadFont(family, style))) throw new Error(`Cannot load font ${family} / ${style}`);
    await build({
      configFile: resolve("vite.config.ts"),
      base: "/implementation/",
      publicDir: false,
      input: { design: resolve("tests/fixtures/design-view.html") },
      build: { outDir: join(temporary, "implementation"), emptyOutDir: true },
    });
    // Capture the real UI first. Native SVG export needs the final world origin
    // before it chooses integer viewports; moving the export afterwards loses it.
    const actual = await capture("actual");
    for (const job of jobs) {
      const { name, target } = job;
      const measured = actual.targets.find((entry) => entry.id === target.id);
      if (!measured) throw new Error(`Browser did not capture target: ${target.id}`);
      if (measured.error || measured.errors.length) continue;
      const original = resolveCaptureSource(graph, target);
      const registered = resolveFigmaNode(graph, target.figma);
      const phase = target.kind === "component" ? (target.capture?.phase ?? null) : { x: 0, y: 0 };
      const wrapper = graph.createNode("FRAME", graph.getPages()[0].id, {
        name: `Verification/${target.id}`,
        x: 0,
        y: 0,
        width: target.viewport.width,
        height: target.viewport.height,
        fills: [],
        clipsContent: false,
      });
      let parent = wrapper;
      let contextNode;
      let camera;
      let placement = { x: 0, y: 0 };
      const cameraContexts = [];
      if (measured.bounds) {
        const contexts =
          measured.bounds.paintContexts ?? (measured.bounds.paintContext ? [measured.bounds.paintContext] : []);
        for (const [index, context] of contexts.entries()) {
          const previous = contexts[index - 1];
          parent = contextNode = graph.createNode("FRAME", parent.id, {
            name: "Capture paint origin",
            x: context.x - (previous?.x ?? 0),
            y: context.y - (previous?.y ?? 0),
            width: context.width,
            height: context.height,
            fills: [],
            clipsContent: false,
            strokeWeight: Number.parseFloat(context.borderLeft),
            strokeAlign: "INSIDE",
            independentStrokeWeights:
              new Set([context.borderLeft, context.borderTop, context.borderRight, context.borderBottom]).size > 1,
            borderLeftWeight: Number.parseFloat(context.borderLeft),
            borderTopWeight: Number.parseFloat(context.borderTop),
            borderRightWeight: Number.parseFloat(context.borderRight),
            borderBottomWeight: Number.parseFloat(context.borderBottom),
            strokes: [
              {
                type: "SOLID",
                visible: true,
                opacity: 0,
                color: { r: 0, g: 0, b: 0, a: 1 },
                weight: Number.parseFloat(context.borderLeft),
                align: "INSIDE",
              },
            ],
          });
          cameraContexts.push({ ...context, nodeId: contextNode.id });
        }
        const context = contexts.at(-1);
        const border = context
          ? {
              left: Number.parseFloat(context.borderLeft),
              right: Number.parseFloat(context.borderRight),
              top: Number.parseFloat(context.borderTop),
              bottom: Number.parseFloat(context.borderBottom),
            }
          : { left: 0, right: 0, top: 0, bottom: 0 };
        placement = {
          x: measured.bounds.nominal.x - (context?.x ?? 0) - border.left,
          y: measured.bounds.nominal.y - (context?.y ?? 0) - border.top,
        };
        camera = graph.createNode("FRAME", parent.id, {
          name: "Capture camera",
          x: border.left,
          y: border.top,
          width: context ? context.width - border.left - border.right : target.viewport.width,
          height: context ? context.height - border.top - border.bottom : target.viewport.height,
          fills: [],
          clipsContent: false,
        });
        parent = camera;
      }
      const instance =
        original.type === "COMPONENT"
          ? graph.createInstance(original.id, parent.id, placement)
          : graph.cloneTree(original.id, parent.id, placement);
      if (!instance) throw new Error(`Cannot prepare native node: ${target.id}`);
      if (["COMPONENT", "INSTANCE"].includes(original.type)) {
        const wrapped = api.wrapNode(instance.id);
        try {
          setComponentProperties(wrapped, target.figma.properties, graph);
          setNestedComponentProperties(wrapped, target.figma.nestedProperties, graph);
        } catch (error) {
          throw new Error(`${target.id}: ${error.message}`, { cause: error });
        }
      } else if (Object.keys(target.figma.properties ?? {}).length || target.figma.nestedProperties?.length)
        throw new Error(`Frame cannot receive component properties: ${target.id}`);
      const current = graph.getNode(instance.id);
      const composites = (target.covers ?? []).map((cover) => {
        const resolved = resolveCompositeComponent(graph, target, cover);
        const placed = resolveCompositeClone(graph, current, resolved);
        const entry = graph.getMainComponent(placed.id);
        if (entry?.type !== "COMPONENT" || entry.parentId !== resolved.main.parentId)
          throw new Error("Covered properties changed the saved instance outside its registered component/set");
        if (cover.source.platform === "select-popup" && entry.id !== resolved.main.id)
          throw new Error("Covered popup must retain its exact static main");
        const ownerBox = api.wrapNode(placed.id).absoluteBoundingBox;
        if (!ownerBox || !(ownerBox.width > 0 && ownerBox.height > 0))
          throw new Error("Covered instance requires a positive saved owner bounding box");
        const ownerOutsets = { left: 0, top: 0, right: 0, bottom: 0 };
        const visit = (node) => {
          if (!node.visible || node.internalOnly) return;
          const wrapped = api.wrapNode(node.id);
          const box = wrapped.absoluteBoundingBox;
          const rendered = wrapped.absoluteRenderBounds ?? box;
          if (box && rendered && box.width > 0 && box.height > 0) {
            if (ownerBox) {
              ownerOutsets.left = Math.max(ownerOutsets.left, ownerBox.x - rendered.x);
              ownerOutsets.top = Math.max(ownerOutsets.top, ownerBox.y - rendered.y);
              ownerOutsets.right = Math.max(
                ownerOutsets.right,
                rendered.x + rendered.width - ownerBox.x - ownerBox.width,
              );
              ownerOutsets.bottom = Math.max(
                ownerOutsets.bottom,
                rendered.y + rendered.height - ownerBox.y - ownerBox.height,
              );
            }
          }
          for (const child of graph.getChildren(node.id)) visit(child);
        };
        visit(placed);
        let overlay;
        if (resolved.overlay) {
          const savedActions = resolveNativeInteractions(original, original, target.figma.interactions, graph);
          const exportedActions = resolveNativeInteractions(original, current, target.figma.interactions, graph);
          const index = savedActions.findIndex((action) => action.nodeId === resolved.overlay.triggerSourceId);
          if (index < 0) throw new Error("Covered popup has no exported saved trigger");
          overlay = { destinationId: resolved.overlay.destinationId, triggerNodeId: exportedActions[index].nodeId };
        }
        return {
          component: cover.component,
          state: cover.state,
          platform: cover.source.platform,
          instanceId: resolved.instance.id,
          nodeId: placed.id,
          mainId: resolved.main.id,
          entryMainId: entry.id,
          ownerNodeId: current.id,
          ...(overlay ? { overlay } : {}),
          properties: observeCompositeProperties(api, graph, placed, resolved.main, cover.figma.properties),
          // Ordinary prototype compilation can replace a variant's descendants.
          // Its owner identity survives. Cover its full saved paint envelope;
          // the browser separately follows the actual WAAPI target/paint layer.
          paintNodes: [{ nodeId: placed.id, outsets: ownerOutsets }],
        };
      });
      const nativeScroll = target.figma.scroll ? resolveNativeScroll(current, target.figma.scroll, graph) : undefined;
      const nativeInteractions = target.figma.interactions
        ? resolveNativeInteractions(original, current, target.figma.interactions, graph)
        : [];
      if (![current.width, current.height].every((value) => Number.isFinite(value) && value > 0))
        throw new Error(`Native target must have positive dimensions: ${target.id}`);
      const main = original.type === "COMPONENT" ? (graph.getNode(current.componentId) ?? original) : original;
      const capturedPlacement = measured.bounds
        ? nativeCapturePlacement(
            measured.bounds.nominal,
            { x: measured.bounds.nominal.x - placement.x, y: measured.bounds.nominal.y - placement.y },
            {
              ...current,
              horizontalConstraint: main.horizontalConstraint,
              verticalConstraint: main.verticalConstraint,
            },
          )
        : placement;
      graph.updateNode(current.id, {
        ...capturedPlacement,
        horizontalConstraint: main.horizontalConstraint,
        verticalConstraint: main.verticalConstraint,
        scrollBehavior: main.scrollBehavior,
      });
      if (
        target.kind === "screen" &&
        (current.width !== target.viewport.width || current.height !== target.viewport.height)
      )
        throw new Error(`Screen frame must equal its viewport: ${target.id}`);
      for (const [family, style] of fontManager.collectFontKeys(graph, [wrapper.id]))
        if (!(await fontManager.loadFont(family, style))) throw new Error(`Cannot load font ${family} / ${style}`);
      const exported = await htmlFormat.exportContent(
        {
          graph,
          target: { scope: "node", nodeId: target.kind === "screen" ? current.id : wrapper.id },
          fileName: "frame.html",
        },
        { html: "standalone", style: "inline", assets: "external", fonts: "assets", lang: "ja" },
      );
      await writeSharedExport(exported, references, `${name}.html`, writtenAssets);
      graph.deleteNode(wrapper.id);
      Object.assign(job, {
        resolvedNodeId: registered.id,
        captureSourceNodeId: original.id,
        nativeNodeId: current.id,
        composites,
        cameraNodeId: camera?.id,
        contextNodeId: contextNode?.id,
        cameraContexts: measured.bounds ? cameraContexts : undefined,
        nativeScroll,
        nativeInteractions,
        sourceGeometry: { ...nativeSizing(current), phase },
      });
      const memory = process.memoryUsage();
      process.stdout.write(
        `Prepared ${target.id} (RSS ${Math.round(memory.rss / 1024 ** 2)}MiB, heap ${Math.round(memory.heapUsed / 1024 ** 2)}MiB, nodes ${graph.nodes.size})\n`,
      );
    }
    const browserReport = await capture("reference");
    report.environment.browser = browserReport.browser;
    report.environment.captures = { implementation: actual.environment, native: browserReport.environment };
    report.environment.screenInfos = { implementation: actual.screenInfos, native: browserReport.screenInfos };
    for (const job of jobs) {
      const result = browserReport.targets.find((target) => target.id === job.target.id);
      if (!result) throw new Error(`Browser did not report target: ${job.target.id}`);
      const record = {
        ...result,
        error: result.error ?? (result.errors.length ? result.errors.join("\n") : undefined),
        kind: job.target.kind,
        component: job.target.component,
        fixture: job.target.fixture,
        interaction: job.target.interaction,
        viewport: job.target.viewport,
        capture: job.target.capture,
        figma: { ...job.target.figma, resolvedNodeId: job.resolvedNodeId },
        state: job.target.state,
      };
      if (!record.error) {
        const implementation = join(destination, `${job.name}.implementation.png`);
        const reference = join(destination, `${job.name}.figma.png`);
        await cp(join(temporary, `${job.name}.implementation.png`), implementation);
        await cp(join(temporary, `${job.name}.figma.png`), reference);
        record.artifacts = { implementation: `${job.name}.implementation.png`, native: `${job.name}.figma.png` };
        record.comparison = await comparePNG(implementation, reference);
        if (
          job.target.kind === "component" &&
          (typeof job.padding === "number" ? job.padding > 0 : Object.values(job.padding).some((value) => value > 0))
        ) {
          record.outset = {
            implementation: await clearCaptureBoundary(implementation, result.backgroundRGBA),
            native: await clearCaptureBoundary(reference, result.backgroundRGBA),
          };
          if (!record.outset.implementation.clear || !record.outset.native.clear)
            record.error = "Paint reaches the capture boundary; isolate the component and increase its outset";
        }
        if (job.target.covers?.length && !record.error) {
          try {
            record.covered = assertCompositeCoverage(job.target, job.composites, result.composites, record.comparison);
          } catch (error) {
            record.error = error.message;
          }
        }
      }
      report.targets.push(record);
      process.stdout.write(
        `${job.target.id}: ${record.error ?? `${record.comparison.differentPixels ?? "dimension mismatch"} pixels differ`}\n`,
      );
    }
    report.identical =
      report.targets.length === targets.length &&
      report.targets.every((target) => !target.error && target.comparison?.identical);
    report.complete = selected.size === 0 && report.identical && report.errors.length === 0;
  } catch (error) {
    report.errors.push(error.message);
  } finally {
    if (ownsBrowserContainer) {
      try {
        await run("docker", ["stop", "--time", "1", browserContainer]);
      } catch (error) {
        report.errors.push(error.message);
        report.complete = false;
      }
    }
    await saveReport();
    if (!keepExport) await rm(temporary, { recursive: true, force: true });
  }
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      bindings: { type: "string" },
      output: { type: "string" },
      select: { type: "string" },
      container: { type: "string" },
      "container-root": { type: "string" },
      "keep-export": { type: "boolean", default: false },
    },
  });
  if (positionals.length !== 1)
    throw new Error(
      "Usage: verify-design OPENPENCIL_SOURCE [--bindings FILE.json] [--output DIRECTORY] [--select ID,ID] [--container NAME] [--container-root /work] [--keep-export]",
    );
  const { "keep-export": keepExport, "container-root": containerRoot, ...options } = values;
  const report = await verifyDesign(positionals[0], {
    ...options,
    keepExport,
    select: values.select?.split(",") ?? [],
    containerRoot,
  });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.identical || report.errors.length) process.exitCode = 1;
}

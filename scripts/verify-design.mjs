import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { DESIGN_IMAGE } from "./design-environment.mjs";
import { designPipelineFingerprint } from "./design-pipeline.mjs";
import { prepareDesignSelection } from "./design-selection.mjs";
import { designConcurrency, parallelMap } from "./design-workers.mjs";
import { OPENPENCIL_REVISION } from "./openpencil.mjs";
import { DESIGN_BROWSER_ARGS, DESIGN_BROWSER_SCREEN, validateBindings } from "./verify-design-bindings.mjs";

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
    keepExport = false,
    changed = false,
    diffOnly = false,
    listOnly = false,
    snapshot = ".openpencil/design-snapshot.json",
    workers = "auto",
  } = {},
) {
  const started = performance.now();
  const destination = resolve(output);
  await mkdir(destination, { recursive: true });
  const settingsBytes = await readFile(resolve(bindings));
  const settings = JSON.parse(settingsBytes);
  const input = await readFile(resolve(settings.document));
  const report = {
    document: settings.document,
    inputSHA256: sha256(input),
    environment: {
      image: DESIGN_IMAGE,
      openpencilRevision: OPENPENCIL_REVISION,
      deviceScaleFactor: 1,
      browserArgs: DESIGN_BROWSER_ARGS,
      screen: DESIGN_BROWSER_SCREEN,
    },
    scope: select.length ? "selected" : changed || diffOnly ? "changed" : "all",
    complete: false,
    identical: false,
    errors: [],
    targets: [],
    timings: {},
  };
  const workspace = resolve(".openpencil/verification");
  await mkdir(workspace, { recursive: true });
  const temporary = await mkdtemp(join(workspace, "verify-"));
  await mkdir(join(temporary, "reference"));
  if (keepExport) report.exportDirectory = temporary;
  const phase = async (name, task) => {
    const start = performance.now();
    try {
      return await task();
    } finally {
      report.timings[name] = (performance.now() - start) / 1000;
    }
  };
  const capture = async (jobFile) => {
    await run("node", [resolve("scripts/verify-design-browser.mjs"), temporary, jobFile]);
    return JSON.parse(await readFile(join(temporary, `${jobFile}.result.json`), "utf8"));
  };
  const assertSettingsUnchanged = async () => {
    if (sha256(await readFile(resolve(settings.document))) !== report.inputSHA256)
      throw new Error("Design master changed during verification");
    if (sha256(await readFile(resolve(bindings))) !== sha256(settingsBytes))
      throw new Error("Design document settings changed during verification");
  };
  try {
    await phase("storybookBuild", () =>
      run("node", [
        resolve("node_modules/storybook/dist/bin/dispatcher.js"),
        "build",
        "--quiet",
        "--output-dir",
        join(temporary, "implementation"),
      ]),
    );
    await writeFile(join(temporary, "manifest.json"), JSON.stringify({ mode: "manifest", settings }));
    const collected = await phase("inventory", () => capture("manifest"));
    const manifest = collected.manifest;
    report.bindingsSHA256 = sha256(JSON.stringify(manifest));
    report.environment.browser = collected.browser;
    report.environment.physicalScreen = collected.environment.physicalScreen;
    if (listOnly) {
      report.scope = "inventory";
      report.inventory = manifest;
      report.listOnly = true;
      return report;
    }
    const { parseFigFile } = await import(pathToFileURL(join(resolve(source), "packages/core/dist/index.js")).href);
    const graph = await parseFigFile(input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength), {
      populate: "all",
    });
    report.errors.push(...validateBindings(manifest, graph, { complete: select.length === 0 }));
    if (report.errors.length) return report;
    const environment = { ...report.environment, pipeline: await designPipelineFingerprint() };
    const selection = await phase("selection", () =>
      prepareDesignSelection({
        graph,
        manifest,
        storybookDirectory: join(temporary, "implementation"),
        snapshotPath: resolve(snapshot),
        select,
        changed,
        diffOnly,
        environment,
      }),
    );
    report.scope = selection.scope;
    report.selection = {
      total: manifest.targets.length,
      selected: selection.selectedTargetIds.length,
      unchanged: selection.unchangedCount,
      changes: selection.changes,
      baseline: selection.baseline,
    };
    if (diffOnly) {
      report.diffOnly = true;
      return report;
    }
    const chosen = new Set(selection.selectedTargetIds);
    const targets = manifest.targets.filter((target) => chosen.has(target.id));
    if (!targets.length) {
      await assertSettingsUnchanged();
      report.identical = true;
      report.complete = selection.baseline.available && select.length === 0;
      if (report.complete && selection.changes.removed.length) {
        selection.snapshot.verified = true;
        await writeFile(resolve(snapshot), `${JSON.stringify(selection.snapshot)}\n`);
      }
      return report;
    }
    const parallelism = (memoryPerWorker) => {
      const available = designConcurrency({ workers, memoryPerWorker });
      return { ...available, workers: Math.min(available.workers, targets.length) };
    };
    const jobs = targets.map((target, index) => ({
      name: String(index).padStart(4, "0"),
      target,
      padding: target.kind === "component" ? (target.capture?.padding ?? 16) : 0,
    }));
    const split = (items, count) => {
      const chunks = Array.from({ length: count }, () => []);
      items.forEach((item, index) => {
        chunks[index % count].push(item);
      });
      return chunks;
    };
    // Export processes retain the full document. Capture processes only need a
    // browser; reassess available resources after the export processes exit.
    report.parallelism = { export: parallelism(1280 * 1024 * 1024) };
    const exportCount = report.parallelism.export.workers;
    process.stdout.write(
      `Exporting ${targets.length}/${manifest.targets.length} targets with ${exportCount} workers\n`,
    );
    const chunks = split(jobs, exportCount);
    const jobFiles = chunks.map((_, index) => `export-${index}`);
    await Promise.all(
      chunks.map((jobs, index) =>
        writeFile(
          join(temporary, `${jobFiles[index]}.json`),
          JSON.stringify({ document: manifest.document, jobs, output: destination }),
        ),
      ),
    );
    const exported = await phase("export", () =>
      parallelMap(jobFiles, exportCount, async (jobFile) => {
        await run(process.execPath, [resolve("scripts/design-export.mjs"), resolve(source), temporary, jobFile]);
        return JSON.parse(await readFile(join(temporary, `${jobFile}.export.json`), "utf8"));
      }),
    );
    report.parallelism.capture = parallelism(512 * 1024 * 1024);
    const captureCount = report.parallelism.capture.workers;
    process.stdout.write(`Capturing and comparing with ${captureCount} workers\n`);
    const captureChunks = split(
      exported.flatMap((entry) => entry.jobs),
      captureCount,
    );
    const captureFiles = captureChunks.map((_, index) => `capture-${index}`);
    await Promise.all(
      captureChunks.map((entries, index) =>
        writeFile(
          join(temporary, `${captureFiles[index]}.json`),
          JSON.stringify({ mode: "compare", jobs: entries, output: destination }),
        ),
      ),
    );
    const captured = await phase("captureAndCompare", () => parallelMap(captureFiles, captureCount, capture));
    const results = new Map(captured.flatMap((entry) => entry.targets.map((target) => [target.id, target])));
    for (const entry of captured)
      if (
        entry.browser !== collected.browser ||
        JSON.stringify(entry.environment) !== JSON.stringify(collected.environment)
      )
        throw new Error("All capture workers must use the same fixed browser conditions");
    const exportedJobs = new Map(exported.flatMap((entry) => entry.jobs.map((job) => [job.target.id, job])));
    for (const target of targets) {
      const result = results.get(target.id);
      if (!result) throw new Error(`Missing comparison result: ${target.id}`);
      report.targets.push({
        ...result,
        error: result.error ?? (result.errors.length ? result.errors.join("\n") : undefined),
        kind: target.kind,
        component: target.component,
        storyId: target.storyId,
        interaction: target.interaction,
        viewport: target.viewport,
        capture: target.capture,
        figma: { ...target.figma, resolvedNodeId: exportedJobs.get(target.id).resolvedNodeId },
        state: target.state,
      });
    }
    report.identical = report.targets.every((target) => !target.error && target.comparison?.identical);
    report.complete = select.length === 0 && report.identical && report.errors.length === 0;
    if (report.complete) {
      await assertSettingsUnchanged();
      const resourceFiles = { ...selection.snapshot.resourceFiles };
      for (const target of report.targets) {
        const resources = [];
        for (const file of target.resources ?? []) {
          try {
            await access(resolve(file));
            resources.push(file);
          } catch (error) {
            if (error.code !== "ENOENT") throw error;
          }
        }
        resourceFiles[target.id] = resources;
      }
      const verified = await prepareDesignSelection({
        graph,
        manifest,
        storybookDirectory: join(temporary, "implementation"),
        snapshotPath: resolve(snapshot),
        environment,
        resourceFiles,
      });
      for (const [id, target] of Object.entries(selection.snapshot.targets))
        if (verified.snapshot.targets[id]?.referenceHash !== target.referenceHash)
          throw new Error(`Reference inputs changed during verification: ${id}`);
      for (const [file, hash] of Object.entries(selection.fileHashes))
        if (verified.fileHashes[file] !== hash)
          throw new Error(`Implementation input changed during verification: ${file}`);
      if ((await designPipelineFingerprint()).hash !== environment.pipeline.hash)
        throw new Error("Verification pipeline changed during verification");
      verified.snapshot.verified = true;
      await mkdir(resolve(snapshot, ".."), { recursive: true });
      await writeFile(resolve(snapshot), `${JSON.stringify(verified.snapshot)}\n`);
    }
  } catch (error) {
    report.complete = false;
    report.errors.push(error.message);
  } finally {
    if (!keepExport) await rm(temporary, { recursive: true, force: true });
    report.timings.total = (performance.now() - started) / 1000;
    await writeFile(join(destination, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
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
      "keep-export": { type: "boolean", default: false },
      changed: { type: "boolean", default: false },
      diff: { type: "boolean", default: false },
      list: { type: "boolean", default: false },
      snapshot: { type: "string" },
      workers: { type: "string", default: "auto" },
    },
  });
  if (positionals.length !== 1)
    throw new Error(
      "Usage: verify-design OPENPENCIL_SOURCE [--changed|--diff|--list] [--select ID,ID] [--workers auto|N]",
    );
  const { "keep-export": keepExport, diff: diffOnly, list: listOnly, workers, ...options } = values;
  const report = await verifyDesign(positionals[0], {
    ...options,
    keepExport,
    diffOnly,
    listOnly,
    workers: workers === "auto" ? "auto" : Number(workers),
    select: values.select?.split(",").filter(Boolean) ?? [],
  });
  process.stdout.write(
    `${JSON.stringify(
      {
        scope: report.scope,
        compared: report.targets.length,
        listed: report.inventory?.targets.length,
        complete: report.complete,
        identical: report.identical,
        errors: report.errors,
        parallelism: report.parallelism,
        timings: report.timings,
      },
      null,
      2,
    )}\n`,
  );
  if (
    report.errors.length ||
    (!diffOnly && !listOnly && (!report.identical || (values.select === undefined && !report.complete)))
  )
    process.exitCode = 1;
}

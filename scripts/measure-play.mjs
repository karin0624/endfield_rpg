import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { observeWebGLResources, webGLResources } from "../tests/browser/webglResources.ts";

if (!process.argv[2])
  throw new Error("Usage: node scripts/measure-play.mjs output-directory [base-url] [repeats] [profile|plain]");
const directory = resolve(process.argv[2]);
const base = process.argv[3] ?? "http://127.0.0.1:4173";
const repeats = Number(process.argv[4] ?? 3);
const mode = process.argv[5] ?? "profile";
if (!["profile", "plain"].includes(mode)) throw new Error("Unknown measurement mode");
const profiled = mode === "profile";
if (!Number.isInteger(repeats) || repeats < 1) throw new Error("Invalid repeat count");
await mkdir(directory, { recursive: true });
await mkdir(resolve(directory, "build-maps"), { recursive: true });
for (const name of await readdir("dist/assets"))
  if (name.endsWith(".js.map"))
    await writeFile(resolve(directory, "build-maps", name), await readFile(`dist/assets/${name}`));
const browser = await chromium.launch({ headless: true, args: ["--enable-unsafe-swiftshader"] });
const output = {
  browser: browser.version(),
  viewport: { width: 1440, height: 1080 },
  dpr: 1,
  mode,
  workload:
    "Normal distribution; real input adapters, core, sparse screen changes, skill combat, return and save/resume",
  measurementWindows: {
    startup: "goto start to title, fonts and present image decode; new browser context, warm OS/process cache possible",
    sampled: "after title readiness to disposal and one rAF; includes battle setup, playback, waits and exit",
    step: "native locator.click; browser click capture through post-locator observation, two microtasks and layout read (includes driver round trip); excludes later image/decode/rAF waits. Playwright actionability may precede click",
    webgl: "synchronous JavaScript API call wall, includes issuing and any implicit stalls; never GPU elapsed",
  },
  runs: [],
};
try {
  for (let repeat = 0; repeat < repeats; repeat++) {
    const context = await browser.newContext({
      viewport: output.viewport,
      deviceScaleFactor: 1,
      reducedMotion: "no-preference",
    });
    const page = await context.newPage();
    await observeWebGLResources(page);
    await page.addInitScript(
      ({ profiled }) => {
        const samples = {};
        const contexts = new Set();
        for (const prototype of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
          if (!profiled) continue;
          for (const name of [
            "drawElements",
            "drawArrays",
            "bufferData",
            "texImage2D",
            "readPixels",
            "getParameter",
            "flush",
            "finish",
          ]) {
            if (!Object.hasOwn(prototype, name)) continue;
            const original = prototype[name];
            Object.defineProperty(prototype, name, {
              value(...args) {
                contexts.add(this);
                const start = performance.now();
                try {
                  return Reflect.apply(original, this, args);
                } finally {
                  samples[name] ??= { count: 0, wallMs: 0, maxMs: 0 };
                  const sample = samples[name];
                  const elapsed = performance.now() - start;
                  sample.count++;
                  sample.wallMs += elapsed;
                  sample.maxMs = Math.max(sample.maxMs, elapsed);
                }
              },
            });
          }
        }
        document.addEventListener(
          "click",
          () => {
            performance.mark("play-step-start");
            window.diagnosticInputStart = performance.now();
          },
          true,
        );
        Object.assign(window, {
          diagnosticWebGL: () => ({
            calls: structuredClone(samples),
            timerQueryAvailable: [...contexts].map((gl) => !!gl.getExtension("EXT_disjoint_timer_query_webgl2")),
            gpuElapsedMs: null,
          }),
        });
      },
      { profiled },
    );
    const errors = [];
    page.on("pageerror", (error) => {
      errors.push({ message: error.message, stack: error.stack });
      process.stderr.write(`browser error: ${error.stack}\n`);
    });
    const start = performance.now();
    await page.goto(base);
    await page.getByRole("heading", { name: "ENDFIELD RPG", exact: true }).waitFor();
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((image) => image.decode().catch(() => {})));
    });
    const startupWallMs = performance.now() - start;
    const startupResources = await page.evaluate(() =>
      performance.getEntriesByType("resource").map((entry) => ({
        name: entry.name,
        initiatorType: entry.initiatorType,
        transferSize: entry.transferSize,
        encodedBodySize: entry.encodedBodySize,
        startTime: entry.startTime,
        responseStart: entry.responseStart,
        responseEnd: entry.responseEnd,
        duration: entry.duration,
      })),
    );
    const startupWebGL = await page.evaluate(() => window.diagnosticWebGL());
    const session = await context.newCDPSession(page);
    const events = [];
    if (profiled) {
      await session.send("Profiler.enable");
      await session.send("Profiler.setSamplingInterval", { interval: 1000 });
      await session.send("Profiler.start");
      await session.send("HeapProfiler.startSampling", {
        samplingInterval: 16384,
        includeObjectsCollectedByMajorGC: true,
        includeObjectsCollectedByMinorGC: true,
      });
      session.on("Tracing.dataCollected", ({ value }) => events.push(...value));
      await session.send("Tracing.start", {
        categories:
          "toplevel,devtools.timeline,blink.user_timing,v8,disabled-by-default-v8.gc,disabled-by-default-devtools.timeline",
        transferMode: "ReportEvents",
      });
    }
    await page.evaluate(() => performance.mark("play-start"));
    const steps = [];
    const act = async (name, locator) => {
      await locator.waitFor({ state: "visible" });
      const wallStart = performance.now();
      await page.evaluate((name) => performance.mark(`play-action-${name}-start`), name);
      await locator.click();
      const inputToObservedDomWallMs = await page.evaluate(async () => {
        await Promise.resolve();
        await Promise.resolve();
        document.querySelector("#app")?.getBoundingClientRect();
        performance.mark("play-step-end");
        return performance.now() - window.diagnosticInputStart;
      });
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all([...document.images].map((image) => image.decode().catch(() => {})));
        for (let i = 0; i < 2; i++) await new Promise((resolve) => requestAnimationFrame(resolve));
      });
      await page.evaluate((name) => performance.mark(`play-action-${name}-end`), name);
      steps.push({ name, inputToObservedDomWallMs, readyWallMs: performance.now() - wallStart });
      process.stdout.write(`${name}: ${inputToObservedDomWallMs.toFixed(2)} ms input to observed DOM\n`);
    };
    const button = (name) => page.getByRole("button", { name, exact: true });
    await act("new-game", button("新規開始"));
    await act("confirm-new-game", button("実行する"));
    await act("intro-home", button("ホームへ"));
    await act("party", button("出撃編成を見る"));
    await act("party-selection", page.locator("[data-slot='0']"));
    await act("character-details", button("ロッシの詳細"));
    await act("details-back", page.locator("[data-details-back]"));
    await act("party-confirm", page.locator("[data-confirm]"));
    await act("party-home", page.locator("[data-party-back]"));
    await act("destinations", button("探索先を選ぶ"));
    await act("town", button("街"));
    await act("town-home-before-market", page.locator("[data-home]"));
    await act("destinations-again", button("探索先を選ぶ"));
    await act("town-again", button("街"));
    await act("market", page.locator("[data-place-id='market']"));
    await act("shop-open", button("買物"));
    await act("shop-close", page.locator("[data-shop-close]"));
    await act("market-complete", page.locator("[data-conversation-stage]"));
    await act("town-home", page.locator("[data-home]"));
    await act("dungeon-destinations", button("探索先を選ぶ"));
    await act("prepare-departure", button("ダンジョン"));
    await act("depart", page.locator("[data-depart]"));
    await act("conversation-node", page.locator("[data-node-id='conversation-b']"));
    await act("conversation-advance", page.locator("[data-conversation-stage]"));
    await act("conversation-choice", page.locator("[data-option-id='mark-on-map']"));
    await act("growth-power", page.locator("[data-growth-screen]").getByRole("button", { name: /^威力補正/ }));
    await act("growth-strike", page.locator("[data-growth-screen]").getByRole("button", { name: /^軽撃/ }));
    await act("boss-entry", page.locator("[data-node-id='boss-c']"));
    const sceneWait = performance.now();
    await page.evaluate(() => performance.mark("play-scene-wait-start"));
    await page.locator("canvas[data-ready='true']").waitFor({ state: "attached", timeout: 60000 });
    const battleReadyWallMs = performance.now() - sceneWait;
    await page.evaluate(() => performance.mark("play-scene-wait-end"));
    const preparedWebGL = await page.evaluate(() => window.diagnosticWebGL());
    const preparedResources = await page.evaluate(() =>
      performance.getEntriesByType("resource").map((entry) => ({
        name: entry.name,
        initiatorType: entry.initiatorType,
        transferSize: entry.transferSize,
        encodedBodySize: entry.encodedBodySize,
        startTime: entry.startTime,
        responseStart: entry.responseStart,
        responseEnd: entry.responseEnd,
        duration: entry.duration,
      })),
    );
    for (let attack = 0; attack < 2; attack++) {
      await act(`skills-${attack}`, page.locator("[data-skills]"));
      await act(`select-strike-${attack}`, button("攻撃"));
      await act(`use-strike-${attack}`, page.locator("[data-use-skill]"));
      // Let the normal animation clock render representative cue frames before skipping.
      await page.evaluate(async () => {
        performance.mark("play-cue-wait-start");
        for (let i = 0; i < 12; i++) await new Promise((resolve) => requestAnimationFrame(resolve));
        performance.mark("play-cue-wait-end");
      });
      if (await page.locator("[data-sequence-skip]").isVisible())
        await act(`skip-${attack}`, page.locator("[data-sequence-skip]"));
    }
    await act("battle-finish", page.locator("[data-rematch]"));
    await act("return-home", page.locator("[data-outcome-screen] [data-return-town]"));
    await act("save-title", button("保存してタイトルへ戻る"));
    await act("save-confirm", button("実行する"));
    await act("resume", button("続きから"));
    const final = await page.evaluate(() => ({
      screen: document.querySelector("[data-campaign-screen]")?.getAttribute("data-campaign-screen"),
      calendar: document.querySelector("[data-calendar]")?.textContent,
      status: document.querySelector(".campaign-status")?.textContent,
    }));
    if (final.screen !== "home" || final.calendar !== "2日目 · 昼")
      throw new Error(`Unexpected real-play result: ${JSON.stringify(final)}`);
    await page.evaluate(() => {
      performance.mark("play-end");
      window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: false }));
    });
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    const webgl = await page.evaluate(() => window.diagnosticWebGL());
    if (profiled) {
      const { profile } = await session.send("Profiler.stop");
      const allocation = await session.send("HeapProfiler.stopSampling");
      const done = new Promise((resolve) => session.once("Tracing.tracingComplete", resolve));
      await session.send("Tracing.end");
      await done;
      await writeFile(resolve(directory, `${repeat}-play-cpu.json`), JSON.stringify(profile));
      await writeFile(resolve(directory, `${repeat}-play-allocation.json`), JSON.stringify(allocation.profile));
      await writeFile(resolve(directory, `${repeat}-play-trace.json`), JSON.stringify({ traceEvents: events }));
    } else {
      events.push(
        ...(await page.evaluate(() =>
          performance.getEntriesByType("mark").map((entry) => ({
            name: entry.name,
            ts: entry.startTime * 1000,
          })),
        )),
      );
    }
    const resourcesAfterExit = await webGLResources(page);

    const startMark = events.findLast((event) => event.name === "play-start").ts;
    const endMark = events.findLast((event) => event.name === "play-end").ts;
    const main = events.find((event) => event.name === "thread_name" && event.args?.name === "CrRendererMain");
    const slices = (name) =>
      events.filter(
        (event) =>
          event.name === name &&
          event.ph === "X" &&
          event.pid === main.pid &&
          event.tid === main.tid &&
          event.ts < endMark &&
          event.ts + event.dur > startMark,
      );
    const sliceTotal = (name) => {
      if (!main) return null;
      const all = slices(name);
      const contained = all.filter((event) => event.ts >= startMark && event.ts + event.dur <= endMark);
      return {
        count: all.length,
        wallMs:
          all.reduce(
            (sum, event) => sum + Math.max(0, Math.min(endMark, event.ts + event.dur) - Math.max(startMark, event.ts)),
            0,
          ) / 1000,
        containedThreadCpuMs: contained.every((event) => event.tdur !== undefined)
          ? contained.reduce((sum, event) => sum + event.tdur, 0) / 1000
          : null,
        knownContainedThreadCpuMs: contained.reduce((sum, event) => sum + (event.tdur ?? 0), 0) / 1000,
        containedSlicesWithoutThreadTime: contained.filter((event) => event.tdur === undefined).length,
        boundarySlices: all.length - contained.length,
      };
    };
    const phaseWindows = [];
    for (const event of events.filter((event) =>
      /^(play-action-.*|play-scene-wait|play-cue-wait)-start$/.test(event.name),
    )) {
      const end = events.find((next) => next.name === event.name.replace(/-start$/, "-end") && next.ts >= event.ts);
      if (end) phaseWindows.push({ name: event.name.slice(0, -6), wallMs: (end.ts - event.ts) / 1000 });
    }
    const spanMs = (endMark - startMark) / 1000;
    const trace = {
      spanMs,
      phaseWindows,
      unassignedBetweenPhaseMs: spanMs - phaseWindows.reduce((sum, phase) => sum + phase.wallMs, 0),
      mainTask: sliceTotal("RunTask"),
      nestedCommit: sliceTotal("Commit"),
      nestedAnimationCallback: sliceTotal("FireAnimationFrame"),
    };
    output.runs.push({
      trace,
      repeat,
      startupWallMs,
      startupResources,
      startupWebGL,
      preparedWebGL,
      preparedResources,
      steps,
      battleReadyWallMs,
      webgl,
      final,
      resourcesAfterExit,
      errors,
    });
    await writeFile(resolve(directory, "results.json"), JSON.stringify(output, null, 2));
    process.stdout.write(
      `${repeat} play: startup ${startupWallMs.toFixed(1)} ms, scene wait ${battleReadyWallMs.toFixed(1)} ms, ${steps.length} inputs, resources ${JSON.stringify(resourcesAfterExit)}\n`,
    );
    await context.close();
    if (errors.length || Object.values(resourcesAfterExit).some((count) => count !== 0))
      throw new Error(JSON.stringify({ errors, resourcesAfterExit }));
  }
} finally {
  await browser.close();
}

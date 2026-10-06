import { initialBattleCombatants } from "../../src/content/initialBattle";
import {
  advanceBattleToNextAllyInput,
  createBattleState,
  performBasicAttackAndAdvanceToAllyInput,
} from "../../src/game/battle";
import {
  type BattleInput,
  type BattleModel,
  createBattleModel,
  reduceBattleModel,
} from "../../src/presentation/battleModel";
import { projectBattleActors } from "../../src/presentation/battleProjection";
import { parseBattleSettings } from "../../src/presentation/battleSettings";
import { projectBattleView } from "../../src/presentation/battleViewProjection";
import { campaignMachine, campaignRules, createCampaignModel } from "../../src/presentation/campaignModel";
import { projectCampaign } from "../../src/presentation/campaignProjection";
import settings from "../../src/web/battle-settings.json";
import { createBattleRenderer } from "../../src/web/battleScene";
import { createBattleView } from "../../src/web/battleView.svelte.ts";
import { createCampaignView } from "../../src/web/campaignView.svelte.ts";
import "../../src/web/style.css";

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error("Missing measurement root");
const app = root;
const before = advanceBattleToNextAllyInput(createBattleState(initialBattleCombatants)).state;
const action = performBasicAttackAndAdvanceToAllyInput(before, before.currentActorId ?? "player", "slime");
if (!action.accepted) throw new Error(action.reason);
const baseInput = {
  battle: action.state,
  basicAttack: true,
  items: false,
  itemCount: 0,
  enemyDepths: [
    { id: "slime", depth: 5 },
    { id: "slime-2", depth: 6 },
  ],
};
const initial = reduceBattleModel(
  createBattleModel({ before, after: action.state, events: action.events }, 0),
  baseInput,
  {
    type: "scene-ready",
    owner: 0,
  },
).state;
let state = initial;
let allocations = 0,
  removals = 0,
  attributes = 0,
  texts = 0;
const observer = new MutationObserver((records) => {
  for (const record of records) {
    allocations += record.addedNodes.length;
    removals += record.removedNodes.length;
    attributes += Number(record.type === "attributes");
    texts += Number(record.type === "characterData");
  }
});
const durations: Record<string, number[]> = {};
function timed<T>(name: string, work: () => T): T {
  const start = performance.now();
  try {
    return work();
  } finally {
    durations[name] ??= [];
    durations[name].push(performance.now() - start);
  }
}
const nextFrame = () => new Promise<number>((resolve) => requestAnimationFrame(resolve));
async function run(
  workload: "battle" | "marker" | "cue" | "switch" | "switch-paced" | "battle-skills",
  frames = 180,
  pauseForProfiler = false,
) {
  const input: BattleInput =
    workload === "battle-skills" ? { ...baseInput, rules: campaignRules, items: true, itemCount: 2 } : baseInput;
  observer.disconnect();
  app.replaceChildren();
  app.innerHTML =
    '<main class="battle-screen"><div class="game-board"><section class="stage"><canvas></canvas></section></div></main>';
  const board = app.querySelector<HTMLDivElement>(".game-board");
  const canvas = app.querySelector<HTMLCanvasElement>("canvas");
  if (!board || !canvas) throw new Error("Missing battle measurement surface");
  const control = new URLSearchParams(location.search).get("control") ?? "none";
  if (control === "canvas-hidden") canvas.style.visibility = "hidden";
  const preparation = performance.now();
  const renderer = createBattleRenderer(canvas, parseBattleSettings(settings));
  const scene = renderer.beginBattle(initialBattleCombatants, undefined, projectBattleActors(initial.playback));
  await scene.ready;
  const sceneReadyMs = performance.now() - preparation;
  const view: ReturnType<typeof createBattleView> & {
    renderModel?: (model: BattleModel, input: BattleInput) => void;
  } = createBattleView(board, scene, (event) => {
    state = reduceBattleModel(state, input, event).state;
    return true;
  });
  state = reduceBattleModel(initial, input, { type: "playback", event: { type: "skip" } }).state;
  function applyView() {
    if (view.renderModel) timed("model-submit", () => view.renderModel?.(state, input));
    else {
      const frame = timed("projection", () => projectBattleView(state, input));
      const measure = timed("dom-submit", () => view.paint(frame));
      if (measure) state = reduceBattleModel(state, input, { type: "party-measured", measure }).state;
    }
  }
  applyView();
  await view.settled();
  await document.fonts.ready;
  await Promise.all([...app.querySelectorAll("img")].map((image) => image.decode().catch(() => {})));
  const uiReadyMs = performance.now() - preparation;
  for (let warmup = 0; warmup < 20; warmup++) await nextFrame();
  let campaign: ReturnType<typeof createCampaignView> | undefined;
  const base = createCampaignModel();
  // Prepare direct snapshots before profilerReady; first rendering stays in the workload.
  const campaignSnapshots =
    workload === "switch" || workload === "switch-paced"
      ? (["home", "destinations", "town"] as const).map((value) =>
          campaignMachine.resolveState({ value, context: base.context }),
        )
      : [];
  if (workload === "switch" || workload === "switch-paced") {
    view.dispose();
    app.replaceChildren();
    campaign = createCampaignView(app, () => false);
  }
  for (const key of Object.keys(durations)) delete durations[key];
  allocations = removals = attributes = texts = 0;
  observer.observe(app, { subtree: true, childList: true, attributes: true, characterData: true });
  if (pauseForProfiler) {
    await new Promise<void>((resolve) => {
      Object.assign(window, { beginMeasurement: resolve });
      app.dataset.profilerReady = "true";
    });
    delete app.dataset.profilerReady;
  }
  const gl = canvas.getContext("webgl2");
  const timer = gl?.getExtension("EXT_disjoint_timer_query_webgl2");
  type FenceResult = { completionWaitWallMs: number | null; status: string; polls: number };
  const fence: FenceResult = { completionWaitWallMs: null, status: "not-issued", polls: 0 };
  const finalFence: FenceResult = { completionWaitWallMs: null, status: "not-issued", polls: 0 };
  function issueFence(record: FenceResult) {
    if (!gl) return;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    if (!sync) throw new Error("Missing diagnostic fence");
    const start = performance.now();
    gl.flush();
    record.status = "pending";
    return new Promise<void>((resolve) => {
      const poll = () => {
        record.polls++;
        const status = gl.clientWaitSync(sync, 0, 0);
        if (
          status === gl.ALREADY_SIGNALED ||
          status === gl.CONDITION_SATISFIED ||
          status === gl.WAIT_FAILED ||
          performance.now() - start > 60000
        ) {
          record.completionWaitWallMs = performance.now() - start;
          record.status = status === gl.WAIT_FAILED ? "failed" : status === gl.TIMEOUT_EXPIRED ? "timeout" : "complete";
          gl.deleteSync(sync);
          resolve();
        } else setTimeout(poll, 1);
      };
      poll();
    });
  }
  let completion: Promise<void> | undefined;
  performance.mark("view-workload-start");
  const intervals: number[] = [],
    totals: number[] = [];
  const switches: {
    from: string;
    to: string;
    frame: number;
    applyWallMs: number;
  }[] = [];
  const switchEveryFrames = workload === "switch-paced" ? 30 : 1;
  let previousScreen = "empty";
  let previous: number | undefined;
  for (let index = 0; index < frames; index++) {
    const timestamp = await nextFrame();
    if (previous !== undefined) intervals.push(timestamp - previous);
    previous = timestamp;
    performance.mark(`view-frame-${index}`);
    const start = performance.now();
    if (campaign) {
      if (index % switchEveryFrames === 0) {
        const screenIndex = Math.floor(index / switchEveryFrames);
        const snapshot = campaignSnapshots[screenIndex % 3];
        const frame = timed("projection", () => projectCampaign(snapshot));
        timed("dom-submit", () => campaign?.render(frame));
        await Promise.resolve();
        switches.push({ from: previousScreen, to: snapshot.value, frame: index, applyWallMs: 0 });
        previousScreen = snapshot.value;
      }
    } else {
      if (workload === "cue" && index % 90 === 0) state = initial;
      state = timed(
        "model",
        () =>
          reduceBattleModel(state, input, { type: "playback", event: { type: "advance", elapsedMs: 1000 / 60 } }).state,
      );
      if ((workload === "battle" || workload === "battle-skills") && index % 10 === 0)
        state = timed(
          "model",
          () =>
            reduceBattleModel(state, input, { type: "select-enemy", id: index % 20 === 0 ? "slime" : "slime-2" }).state,
        );
      timed("native", () => {
        const actors = projectBattleActors(state.playback);
        if (control !== "native-static") scene.paintBattleFrame(actors);
      });
      if (workload === "cue" && index === 32) completion = issueFence(fence);
      applyView();
      await view.settled();
    }
    timed("layout-read", () => app.getBoundingClientRect());
    const duration = performance.now() - start;
    totals.push(duration);
    if (campaign && index % switchEveryFrames === 0) switches[switches.length - 1].applyWallMs = duration;
  }
  await nextFrame();
  performance.mark("view-workload-end");
  observer.disconnect();
  const mutations = { added: allocations, removed: removals, attributes, texts };
  const drainStart = performance.now();
  // paintBattleFrame issues scene.render synchronously; the final rAF above also
  // lets an outstanding normal resize renderLoop callback issue before this probe.
  const finalCompletion = workload === "cue" ? issueFence(finalFence) : undefined;
  await Promise.all([completion, finalCompletion]);
  const completionDrainWallMs = performance.now() - drainStart;
  campaign?.dispose();
  if (!campaign) view.dispose();
  scene.dispose();
  renderer.dispose();
  await nextFrame();
  const quantiles = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    return {
      count: values.length,
      p50: sorted[Math.floor(sorted.length * 0.5)] ?? 0,
      p95: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
      sum: values.reduce((a, b) => a + b, 0),
    };
  };
  return {
    workload,
    frames,
    suppliedClockMs: frames * (1000 / 60),
    finalPlayback: {
      phase: state.playback.phase,
      eventIndex: state.playback.eventIndex,
      phaseElapsedMs: state.playback.phaseElapsedMs,
      cue: state.playback.cue,
    },
    control,
    gpu: { timerQueryAvailable: !!timer, elapsedMs: null, fence, finalFence, completionDrainWallMs },
    sceneReadyMs,
    uiReadyMs,
    mutations,
    phases: Object.fromEntries(Object.entries(durations).map(([name, values]) => [name, quantiles(values)])),
    applyWallMs: quantiles(totals),
    frameIntervalMs: quantiles(intervals),
    intervalsOver25ms: intervals.filter((value) => value > 25).length,
    switches,
    switchEveryFrames: campaign ? switchEveryFrames : undefined,
  };
}
Object.assign(window, { measureView: run });
app.dataset.measureReady = "true";

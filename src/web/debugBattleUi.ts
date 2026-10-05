import { initialBattleCombatants } from "../content/initialBattle";
import type { BattleSettings } from "../presentation/battleSettings";
import {
  createDebugBattleModel,
  type DebugBattleEvent,
  type DebugBattleInput,
  projectDebugBattle,
  reduceDebugBattle,
} from "../presentation/debugBattleModel";
import { type BattleScene, createBattleRenderer, initialBattleEnvironment } from "./battleScene";
import { createBattleView } from "./battleView";
import { requiredElement } from "./requiredElement";

/** Actual handles and clock measurements only; the synchronous model owns the game and screen. */
export function mountDebugBattle(app: HTMLElement, settings: BattleSettings, editor: boolean) {
  const board = requiredElement<HTMLDivElement>(app, "[data-board]");
  const canvas = requiredElement<HTMLCanvasElement>(board, "canvas");
  const status = requiredElement<HTMLElement>(board, "[data-status]");
  const events = new AbortController();
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  let input: DebugBattleInput = { combatants: initialBattleCombatants, enemyDepths: [], editor };
  let state = createDebugBattleModel(input, 0, motion.matches);
  let renderer: ReturnType<typeof createBattleRenderer> | undefined;
  let scene: BattleScene | undefined;
  let view: ReturnType<typeof createBattleView> | undefined;
  let animationFrame: number | undefined;
  let previousTime: number | undefined;
  let appliedUtilityFocus: "town" | "editor" | null = null;
  const utilities = document.createElement("div");
  utilities.className = "battle-utility-controls";
  const town = document.createElement("a");
  town.href = "?debug=1";
  town.textContent = "街へ戻る";
  const editorLink = document.createElement("a");
  editorLink.href = "?debug=1&edit=1";
  editorLink.textContent = "構図設定";
  utilities.append(town);
  if (editor) utilities.append(document.createTextNode("\n          "), editorLink);
  utilities.hidden = true;
  app.append(utilities);
  for (const [node, target] of [
    [town, "town"],
    [editorLink, "editor"],
  ] as const)
    node.addEventListener("focus", () => dispatch({ type: "utility-focused", target }), { signal: events.signal });
  utilities.addEventListener(
    "keydown",
    (event) => {
      if (dispatch({ type: "key", key: event.key, shift: event.shiftKey })) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    { signal: events.signal },
  );
  motion.addEventListener(
    "change",
    () => dispatch({ type: "playback", event: { type: "motion", reduced: motion.matches } }),
    { signal: events.signal },
  );

  function clock(animate: boolean) {
    if (!animate) {
      if (animationFrame !== undefined) cancelAnimationFrame(animationFrame);
      animationFrame = undefined;
      previousTime = undefined;
    } else if (animationFrame === undefined) {
      animationFrame = requestAnimationFrame((time) => {
        animationFrame = undefined;
        const elapsedMs = previousTime === undefined ? 0 : time - previousTime;
        previousTime = time;
        dispatch({ type: "playback", event: { type: "advance", elapsedMs } });
      });
    }
  }
  function render() {
    const frame = projectDebugBattle(state, input);
    status.textContent = frame.status.text;
    status.classList.toggle("sr-only", frame.status.ready);
    status.toggleAttribute("data-error", frame.status.error);
    canvas.toggleAttribute("data-ready", frame.status.ready);
    if (frame.status.ready) canvas.dataset.ready = "true";
    utilities.hidden = !frame.status.ready;
    if (frame.view && scene) {
      scene.paintBattleFrame(frame.actors);
      view ??= createBattleView(board, scene, dispatch);
      const measure = view.paint(frame.view);
      if (measure) dispatch({ type: "party-measured", measure });
    }
    const utilityFocus = projectDebugBattle(state, input).utilityFocus;
    if (appliedUtilityFocus !== utilityFocus) {
      appliedUtilityFocus = utilityFocus;
      if (utilityFocus) (utilityFocus === "town" ? town : editorLink).focus();
    }
    clock(projectDebugBattle(state, input).animate);
  }
  function releaseScene() {
    clock(false);
    view?.dispose();
    view = undefined;
    scene?.dispose();
    scene = undefined;
  }
  function startScene(owner: number) {
    releaseScene();
    const actors = projectDebugBattle(state, input).actors;
    const failed = (error: unknown) =>
      dispatch({ type: "scene-error", owner, reason: error instanceof Error ? error.message : String(error) });
    try {
      renderer ??= createBattleRenderer(canvas, settings);
      const ownedScene = renderer.beginBattle(
        state.view.playback.record.before.combatants,
        initialBattleEnvironment,
        actors,
      );
      scene = ownedScene;
      void ownedScene.ready.then(() => dispatch({ type: "scene-ready", owner }), failed);
    } catch (error) {
      failed(error);
    }
  }
  function dispatch(event: DebugBattleEvent): boolean {
    input = { ...input, enemyDepths: scene?.getCombatantDepths() ?? [] };
    const transition = reduceDebugBattle(state, input, event);
    const changed = state !== transition.state;
    state = transition.state;
    for (const effect of transition.effects) {
      if (effect.type === "replace-scene") startScene(effect.owner);
      else {
        releaseScene();
        renderer?.dispose();
      }
    }
    if (changed) render();
    return transition.handled;
  }
  startScene(state.view.scene.owner);
  render();
  return () => {
    events.abort();
    dispatch({ type: "closed" });
    utilities.remove();
  };
}

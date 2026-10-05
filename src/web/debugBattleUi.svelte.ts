import { mount, unmount, untrack } from "svelte";
import { initialBattleCombatants } from "../content/initialBattle";
import { battleMarkerTarget } from "../presentation/battleModel";
import { projectBattleActors } from "../presentation/battleProjection";
import type { BattleSettings } from "../presentation/battleSettings";
import {
  createDebugBattleModel,
  type DebugBattleEvent,
  type DebugBattleInput,
  debugBattleInput,
  reduceDebugBattle,
} from "../presentation/debugBattleModel";
import { type BattleScene, createBattleRenderer, initialBattleEnvironment } from "./battleScene";
import type { createBattleSurface } from "./battleSurface.svelte.ts";
import { createBattleView } from "./battleView.svelte.ts";
import DebugBattleChrome from "./components/DebugBattleChrome.svelte";
import { requiredElement } from "./requiredElement";

/** Actual handles and clock measurements only; the synchronous model owns the game and screen. */
export function mountDebugBattle(
  app: HTMLElement,
  settings: BattleSettings,
  editor: boolean,
  surface: ReturnType<typeof createBattleSurface>,
) {
  const board = requiredElement<HTMLDivElement>(app, "[data-board]");
  const canvas = requiredElement<HTMLCanvasElement>(board, "canvas");
  const events = new AbortController();
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  let input: DebugBattleInput = { combatants: initialBattleCombatants, enemyDepths: [], editor };
  let state = $state.raw(createDebugBattleModel(input, 0, motion.matches));
  let renderer: ReturnType<typeof createBattleRenderer> | undefined;
  let scene: BattleScene | undefined;
  let view: ReturnType<typeof createBattleView> | undefined;
  let animationFrame: number | undefined;
  let previousTime: number | undefined;
  let ready = $derived(state.view.scene.status === "ready"),
    focus = $derived(state.utilityFocus);
  const chrome = mount(DebugBattleChrome, {
    target: app,
    props: {
      editor,
      dispatch,
      get ready() {
        return ready;
      },
      get focus() {
        return focus;
      },
    },
  });
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
    const sceneState = state.view.scene;
    surface.render({
      ready: sceneState.status === "ready",
      error: sceneState.status === "error",
      text:
        sceneState.status === "ready"
          ? "表示準備完了"
          : sceneState.status === "error"
            ? "戦闘画面を読み込めませんでした。素材の取得とWebGL対応を確認して、再読み込みしてください。"
            : "戦闘画面を読み込んでいます…",
    });
    const battleInput = debugBattleInput(state, input);
    if (sceneState.status === "ready" && scene) {
      scene.paintBattleFrame(projectBattleActors(state.view.playback));
      view ??= createBattleView(board, scene, dispatch);
      view.renderModel(state.view, battleInput);
    }
    clock(
      sceneState.status === "ready" &&
        (state.view.playback.phase !== "finished" ||
          (battleMarkerTarget(state.view, battleInput) !== null && !state.view.playback.reducedMotion)),
    );
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
    const actors = projectBattleActors(state.view.playback);
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
  startScene(untrack(() => state.view.scene.owner));
  render();
  return () => {
    events.abort();
    dispatch({ type: "closed" });
    void unmount(chrome);
  };
}

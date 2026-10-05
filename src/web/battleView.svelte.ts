import { flushSync, mount, tick, unmount } from "svelte";
import type { BattleInput, BattleModel, BattleModelEvent } from "../presentation/battleModel";
import { type BattleAppearance, type BattleViewFrame, projectBattleMotion } from "../presentation/battleViewProjection";
import { deriveBattleHud } from "./battlePresentation.svelte.ts";
import type { BattleScene } from "./battleScene";
import BattleHud from "./components/BattleHud.svelte";
import BattleOverlay from "./components/BattleOverlay.svelte";
import { requiredElement } from "./requiredElement";

type SceneProjection = Pick<BattleScene, "getCombatantScreenRect" | "refreshCombatantScreenPositions">;
export function createBattleView(
  board: HTMLDivElement,
  scene: SceneProjection,
  dispatch: (event: BattleModelEvent) => boolean,
  appearance: BattleAppearance = {},
) {
  const stage = requiredElement<HTMLElement>(board, ".stage");
  let frame = $state.raw<BattleViewFrame>();
  let model = $state.raw<BattleModel>();
  let input = $state.raw<BattleInput>();
  // A direct fixture supplies a complete explicit frame; the application supplies committed state.
  const presentation = deriveBattleHud(
    () => {
      if (!model) throw new Error("Battle model is required");
      return model;
    },
    () => {
      if (!input) throw new Error("Battle input is required");
      return input;
    },
    appearance,
  );
  let hud = $derived(model ? presentation.frame : frame);
  let motion = $derived(model && input ? projectBattleMotion(model, input) : frame);
  let hudComponent: ReturnType<typeof mount<Parameters<typeof BattleHud>[0], ReturnType<typeof BattleHud>>> | undefined;
  let overlayComponent: ReturnType<typeof mount> | undefined;
  function ensureMounted() {
    if (hudComponent) return;
    hudComponent = mount(BattleHud, {
      target: board,
      props: {
        board,
        dispatch,
        get frame() {
          if (!hud) throw new Error("Battle HUD is required");
          return hud;
        },
      },
    });
    overlayComponent = mount(BattleOverlay, {
      target: stage,
      props: {
        stage,
        scene,
        dispatch,
        get hud() {
          if (!hud) throw new Error("Battle HUD is required");
          return hud;
        },
        get motion() {
          if (!motion) throw new Error("Battle motion is required");
          return motion;
        },
      },
    });
  }
  return {
    /** Static picture fixture: apply DOM and take its native baseline synchronously. */
    paint(next: BattleViewFrame) {
      frame = next;
      model = undefined;
      ensureMounted();
      flushSync();
      return hudComponent?.measure();
    },
    renderModel(next: BattleModel, nextInput: BattleInput) {
      input = nextInput;
      model = next;
      ensureMounted();
    },
    async settled() {
      await tick();
      await Promise.all(stage.getAnimations({ subtree: true }).map((animation) => animation.ready));
    },
    dispose() {
      if (hudComponent) void unmount(hudComponent);
      if (overlayComponent) void unmount(overlayComponent);
      hudComponent = undefined;
      overlayComponent = undefined;
    },
  };
}

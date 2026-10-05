import { flushSync, mount, unmount } from "svelte";
import { battleMarkerTarget } from "../presentation/battleModel";
import { projectBattleActors } from "../presentation/battleProjection";
import { parseBattleSettings } from "../presentation/battleSettings";
import {
  type DungeonEffect,
  type DungeonEvent,
  type DungeonInput,
  type DungeonModel,
  dungeonBattleInput,
} from "../presentation/dungeonModel";
import { type DungeonFrame, dungeonNames } from "../presentation/dungeonProjection";
import savedBattleSettings from "./battle-settings.json";
import { type BattleScene, createBattleRenderer, initialBattleEnvironment } from "./battleScene";
import { createBattleView } from "./battleView.svelte.ts";
import Dungeon from "./components/Dungeon.svelte";
import { deriveDungeonChrome } from "./dungeonPresentation.svelte.ts";
import { requiredElement } from "./requiredElement";

/** Browser owns real handles; committed semantic state remains synchronous and browser-free. */
export function createDungeonView(root: HTMLDivElement, send: (event: DungeonEvent) => boolean, returnLabel: string) {
  let frame = $state.raw<DungeonFrame | null>(null),
    model = $state.raw<DungeonModel>(),
    input = $state.raw<DungeonInput>();
  const presentation = deriveDungeonChrome(
    () => {
      if (!model) throw new Error("Dungeon model is required");
      return model;
    },
    () => {
      if (!input) throw new Error("Dungeon input is required");
      return input;
    },
    returnLabel,
  );
  let chrome = $derived(model ? presentation.frame : frame);
  let battleSceneState = $derived(model?.screen.kind === "battle" ? model.screen.battle.scene : null);
  let status = $derived(
    model
      ? battleSceneState
        ? {
            ready: battleSceneState.status === "ready",
            error: battleSceneState.status === "error",
            text:
              battleSceneState.status === "ready"
                ? "表示準備完了"
                : battleSceneState.status === "error"
                  ? "戦闘画面を読み込めませんでした。素材とWebGL対応を確認して、再読み込みしてください。"
                  : "戦闘画面を読み込んでいます…",
            reason: battleSceneState.reason,
          }
        : null
      : (frame?.battle?.status ?? null),
  );
  const component = mount(Dungeon, {
    target: root,
    props: {
      root,
      send,
      get frame() {
        return chrome;
      },
      get battleStatus() {
        return status;
      },
    },
  });
  flushSync();
  const board = requiredElement<HTMLDivElement>(root, "[data-board]"),
    canvas = requiredElement<HTMLCanvasElement>(root, "canvas"),
    viewport = requiredElement<HTMLDivElement>(root, "[data-route-viewport]");
  let renderer: ReturnType<typeof createBattleRenderer> | undefined,
    scene: BattleScene | undefined,
    view: ReturnType<typeof createBattleView> | undefined;
  let animation: number | undefined, previousTime: number | undefined;
  function clock(animate: boolean) {
    if (!animate) {
      if (animation !== undefined) cancelAnimationFrame(animation);
      animation = undefined;
      previousTime = undefined;
    } else if (animation === undefined)
      animation = requestAnimationFrame((time) => {
        animation = undefined;
        const elapsedMs = previousTime === undefined ? 0 : time - previousTime;
        previousTime = time;
        send({ type: "battle", event: { type: "playback", event: { type: "advance", elapsedMs } } });
      });
  }
  function closeScene() {
    clock(false);
    view?.dispose();
    view = undefined;
    scene?.dispose();
    scene = undefined;
  }
  return {
    getEnemyDepths: () => scene?.getCombatantDepths() ?? [],
    reducedMotion: () => matchMedia("(prefers-reduced-motion: reduce)").matches,
    effect(effect: DungeonEffect, picture: Pick<NonNullable<DungeonFrame["battle"]>, "definitions" | "actors"> | null) {
      if (effect.type === "capture-pointer") {
        viewport.setPointerCapture(effect.pointerId);
        return;
      }
      closeScene();
      if (effect.type === "close-scene") {
        if (effect.releaseRenderer) {
          renderer?.dispose();
          renderer = undefined;
        }
        return;
      }
      if (!picture) throw new Error("A committed battle picture owns each new scene");
      const failed = (error: unknown) =>
        send({
          type: "battle",
          event: {
            type: "scene-error",
            owner: effect.owner,
            reason: error instanceof Error ? error.message : String(error),
          },
        });
      try {
        renderer ??= createBattleRenderer(canvas, parseBattleSettings(savedBattleSettings));
        scene = renderer.beginBattle(picture.definitions, initialBattleEnvironment, picture.actors);
        void scene.ready.then(
          () => send({ type: "battle", event: { type: "scene-ready", owner: effect.owner } }),
          failed,
        );
      } catch (error) {
        failed(error);
      }
    },
    render(next: DungeonFrame) {
      frame = next;
      model = undefined;
      if (next.battle?.view && scene) {
        scene.paintBattleFrame(next.battle.actors);
        view ??= createBattleView(board, scene, (event) => send({ type: "battle", event }));
        const measure = view.paint(next.battle.view);
        if (measure) send({ type: "battle", event: { type: "party-measured", measure } });
      }
      clock(next.battle?.animate ?? false);
    },
    renderModel(next: DungeonModel, nextInput: DungeonInput) {
      input = nextInput;
      model = next;
      const battle = next.screen.kind === "battle" ? next.screen.battle : null;
      const battleInput = dungeonBattleInput(nextInput);
      if (battle?.scene.status === "ready" && scene) {
        scene.paintBattleFrame(projectBattleActors(battle.playback));
        view ??= createBattleView(board, scene, (event) => send({ type: "battle", event }), {
          names: dungeonNames,
          finishLabel: "ルートへ戻る",
          finishAriaLabel: "戦闘を終えてルートへ戻る",
        });
        view.renderModel(battle, battleInput);
      }
      clock(
        battle?.scene.status === "ready" &&
          (battle.playback.phase !== "finished" ||
            (battleMarkerTarget(battle, battleInput) !== null && !battle.playback.reducedMotion)),
      );
    },
    dispose() {
      closeScene();
      renderer?.dispose();
      renderer = undefined;
      void unmount(component);
    },
  };
}

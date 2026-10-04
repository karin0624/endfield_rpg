import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { GLTFFileLoader } from "@babylonjs/loaders/glTF/glTFFileLoader";
import { initialBattleCombatants } from "../../src/content/initialBattle";
import { type BattleActorFrame, projectInitialBattleActors } from "../../src/presentation/battleProjection";
import { parseBattleSettings } from "../../src/presentation/battleSettings";
import savedSettings from "../../src/web/battle-settings.json";
import { type BattleScene, createBattleRenderer, initialBattleEnvironment } from "../../src/web/battleScene";
import { requiredElement } from "../../src/web/requiredElement";
import { groundCullingViews } from "./ground-culling-views";
import "../../src/web/style.css";

const canvas = requiredElement<HTMLCanvasElement>(document, "canvas");
let renderer: ReturnType<typeof createBattleRenderer> | undefined;
let scene: BattleScene | undefined;
let previous: BattleScene | undefined;
let definitions = initialBattleCombatants.filter(() => true);
let completedLoads = 0;
const observer = SceneLoader.OnPluginActivatedObservable.add((plugin) => {
  if (plugin instanceof GLTFFileLoader)
    plugin.onCompleteObservable.addOnce(() => {
      completedLoads++;
    });
});
const settingsFor = (view: string) => parseBattleSettings({ ...savedSettings, ...groundCullingViews[view] });

const api = {
  create(view = "default") {
    renderer?.dispose();
    renderer = createBattleRenderer(canvas, settingsFor(view));
    scene = undefined;
    previous = undefined;
  },
  start(count: "full" | "small" = "full", environment: "known" | "unknown" | "alternate" = "known") {
    if (!renderer) throw new Error("Create the renderer before its scene");
    previous = scene;
    definitions = initialBattleCombatants.filter(({ id }) => count === "full" || id === "player" || id === "slime-2");
    scene = renderer.beginBattle(
      definitions,
      environment === "known"
        ? initialBattleEnvironment
        : {
            ground: `ground/ground1.glb?environment=${environment}`,
            background:
              environment === "alternate" ? "backgrounds/dungeon-route.png" : initialBattleEnvironment.background,
          },
      projectInitialBattleActors(definitions),
    );
    // The driver can release a pending owner before awaiting it; ready() still exposes its real rejection.
    void scene.ready.catch(() => {});
  },
  ready() {
    if (!scene) throw new Error("Start the scene before waiting for its native assets");
    return scene.ready;
  },
  paint(frame: readonly BattleActorFrame[]) {
    scene?.paintBattleFrame(frame);
  },
  apply(view: string, preview = false) {
    const settings = settingsFor(view);
    if (preview) scene?.previewSettings(settings);
    else scene?.applySettings(settings);
    scene?.paintBattleFrame(projectInitialBattleActors(definitions));
  },
  measure() {
    scene?.refreshCombatantScreenPositions();
    return {
      rect: scene?.getCombatantScreenRect("slime-2"),
      grounding: scene?.getGroundingMeasurements(),
      completedLoads,
    };
  },
  applyToReleasedScene() {
    previous?.applySettings({ ...settingsFor("default"), enemyCenterX: 8 });
    previous?.paintBattleFrame([{ id: "slime-2", visible: false, opacity: 0, emissive: [1, 1, 1] }]);
    previous?.dispose();
  },
  dispose() {
    renderer?.dispose();
    renderer = undefined;
    scene = undefined;
  },
};
export type RendererView = typeof api;
Object.assign(window, { rendererView: api });
window.addEventListener("pagehide", (event) => {
  if (!event.persisted) {
    api.dispose();
    SceneLoader.OnPluginActivatedObservable.remove(observer);
  }
});

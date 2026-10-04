import { initialBattleCombatants } from "../../src/content/initialBattle";
import { advanceBattleToNextAllyInput, createBattleState } from "../../src/game/battle";
import { type BattleInput, createBattleModel, reduceBattleModel } from "../../src/presentation/battleModel";
import { projectInitialBattleActors } from "../../src/presentation/battleProjection";
import { parseBattleSettings } from "../../src/presentation/battleSettings";
import { projectBattleView } from "../../src/presentation/battleViewProjection";
import savedSettings from "../../src/web/battle-settings.json";
import { type BattleScene, createBattleRenderer, initialBattleEnvironment } from "../../src/web/battleScene";
import { createBattleView } from "../../src/web/battleView";
import { requiredElement } from "../../src/web/requiredElement";
import { groundCullingViews } from "./ground-culling-views";
import "../../src/web/style.css";

const board = requiredElement<HTMLDivElement>(document, ".game-board");
const canvas = requiredElement<HTMLCanvasElement>(board, "canvas");
const battle = advanceBattleToNextAllyInput(createBattleState(initialBattleCombatants)).state;
const picture = createBattleModel({ before: battle, after: battle, events: [] }, 0, 1, true);
let renderer: ReturnType<typeof createBattleRenderer> | undefined;
let scene: BattleScene | undefined;
let view: ReturnType<typeof createBattleView> | undefined;
const settingsFor = (name: string) => parseBattleSettings({ ...savedSettings, ...groundCullingViews[name] });

function closePicture() {
  view?.dispose();
  view = undefined;
}
async function paintPicture() {
  if (!scene) throw new Error("The picture needs its prepared native scene");
  const input: BattleInput = {
    battle,
    enemyDepths: scene.getCombatantDepths(),
    basicAttack: true,
    items: false,
    itemCount: 0,
  };
  let state = reduceBattleModel(picture, input, { type: "scene-ready", owner: 0 }).state;
  view ??= createBattleView(board, scene, () => false);
  const measure = view.paint(projectBattleView(state, input));
  if (measure) {
    state = reduceBattleModel(state, input, { type: "party-measured", measure }).state;
    view.paint(projectBattleView(state, input));
  }
  await view.settled();
}
const api = {
  create(name = "default") {
    closePicture();
    renderer?.dispose();
    renderer = createBattleRenderer(canvas, settingsFor(name));
    scene = undefined;
  },
  start(environment: "known" | "unknown" = "known") {
    if (!renderer) throw new Error("Construct the picture's native renderer first");
    closePicture();
    scene = renderer.beginBattle(
      initialBattleCombatants,
      environment === "known"
        ? initialBattleEnvironment
        : { ...initialBattleEnvironment, ground: "ground/ground1.glb?environment=unverified" },
      projectInitialBattleActors(initialBattleCombatants),
    );
  },
  async ready() {
    if (!scene) throw new Error("Start the picture's native scene first");
    await scene.ready;
    await paintPicture();
  },
  async apply(name: string, preview = false) {
    const settings = settingsFor(name);
    if (preview) scene?.previewSettings(settings);
    else scene?.applySettings(settings);
    // Repaint the supplied snapshot in the updated native projection.
    closePicture();
    await paintPicture();
  },
};
export type GroundView = typeof api;
Object.assign(window, { groundView: api });
window.addEventListener("pagehide", (event) => {
  if (!event.persisted) {
    closePicture();
    renderer?.dispose();
  }
});

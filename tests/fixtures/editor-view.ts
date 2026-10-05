import { initialAdventure } from "../../src/content/initialAdventure";
import { initialGameOptions } from "../../src/content/initialGameOptions";
import { createInitialGameState } from "../../src/game/createInitialGameState";
import {
  createAdventureEditorModel,
  projectAdventureEditor,
  reduceAdventureEditor,
} from "../../src/presentation/adventureEditorModel";
import { createAdventureEditorPreview } from "../../src/presentation/adventureModel";
import { projectAdventure } from "../../src/presentation/adventureProjection";
import { parseAdventureSettings } from "../../src/presentation/adventureSettings";
import {
  createBattleEditorModel,
  projectBattleEditor,
  reduceBattleEditor,
} from "../../src/presentation/battleEditorModel";
import { parseBattleSettings } from "../../src/presentation/battleSettings";
import savedAdventure from "../../src/web/adventure-settings.json";
import { createAdventureEditorView } from "../../src/web/adventureEditor";
import { createAdventureView } from "../../src/web/adventureView";
import savedBattle from "../../src/web/battle-settings.json";
import { createBattleEditorView } from "../../src/web/battleEditor";
import { createBattleScene } from "../../src/web/battleScene";
import { requiredElement } from "../../src/web/requiredElement";
import "../../src/web/style.css";
import "../../src/web/debug.css";

const query = new URLSearchParams(location.search);
const app = requiredElement<HTMLDivElement>(document, "#app");
let release: () => void;
if (query.has("adventure")) {
  const saved = query.has("saved");
  document.body.classList.toggle("adventure-editing", !saved);
  if (saved) {
    const badge = document.createElement("aside");
    badge.className = "debug-mode-badge";
    badge.innerHTML = 'デバッグモード · 通常版とは別の保存スロット <a href="?">タイトルへ</a>';
    document.body.prepend(badge);
  }
  let settingsState = createAdventureEditorModel(parseAdventureSettings(savedAdventure));
  for (const [key, raw] of [
    ["leftX", "32"],
    ["rightX", "86"],
    ["panelHeight", "35"],
  ] as const)
    settingsState = reduceAdventureEditor(settingsState, { type: "field", key, raw }).state;
  const conversation = createAdventureEditorPreview(createInitialGameState(initialGameOptions), initialAdventure);
  const frame = projectAdventure({
    state: conversation.game,
    definition: initialAdventure,
    calendar: "1日目 · 昼",
    feedback: [],
    prompt: "行き先を選ぶ",
    editorPreview: !saved,
    debug: saved,
    partyEntry: saved,
    focus: null,
  });
  const view = createAdventureView(app, frame.utilities, () => false, settingsState.current);
  view.render(frame);
  const editor = saved ? undefined : createAdventureEditorView(app, () => false);
  editor?.render(
    projectAdventureEditor({ ...settingsState, focus: { kind: "field", key: "panelHeight", control: "number" } }),
  );
  release = () => {
    editor?.dispose();
    view.dispose();
  };
} else {
  document.body.classList.add("editing");
  app.innerHTML = `<main class="battle-screen"><div class="game-board" data-board><section class="stage" aria-label="荒野の戦闘画面"><canvas aria-label="3Dの地面に立つロッシ、ギルベルタ、青いスライム2体"></canvas><div class="loading sr-only" role="status">表示準備完了</div></section></div></main>`;
  let state = createBattleEditorModel(parseBattleSettings(savedBattle));
  for (const [key, raw] of [
    ["cameraY", "8"],
    ["cameraZ", "13"],
    ["targetY", "3.5"],
    ["fovDegrees", "40"],
    ["groundScale", "1.1"],
    ["backdropScale", "1.15"],
    ["backdropY", "7"],
    ["backdropZ", "-10"],
  ] as const)
    state = reduceBattleEditor(state, { type: "field", key, raw }).state;
  state = { ...state, focus: { kind: "field", key: "backdropZ", control: "number" } };
  const canvas = requiredElement<HTMLCanvasElement>(app, "canvas");
  const scene = createBattleScene(canvas, state.current);
  await scene.ready;
  const editor = createBattleEditorView(app, () => false);
  function paint(count: 1 | 2) {
    const frame = projectBattleEditor({ ...state, counts: { ally: count, enemy: count } });
    scene.applySettings(frame.current, frame.placements);
    scene.paintBattleFrame(frame.actors);
    editor.render(frame);
  }
  Object.assign(window, { paintEditorPicture: paint });
  // The constructor already prepared this full 2-on-2 picture with state.current.
  editor.render(projectBattleEditor(state));
  release = () => {
    editor.dispose();
    scene.dispose();
  };
}
app.dataset.pictureReady = "true";
window.addEventListener("pagehide", (event) => {
  if (!event.persisted) release();
});

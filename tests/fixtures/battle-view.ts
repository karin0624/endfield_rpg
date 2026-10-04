import { reduceBattleModel } from "../../src/presentation/battleModel";
import { projectBattleActors } from "../../src/presentation/battleProjection";
import { parseBattleSettings } from "../../src/presentation/battleSettings";
import { projectBattleView } from "../../src/presentation/battleViewProjection";
import savedSettings from "../../src/web/battle-settings.json";
import { createBattleScene } from "../../src/web/battleScene";
import { createBattleView } from "../../src/web/battleView";
import { requiredElement } from "../../src/web/requiredElement";
import { battlePictures } from "../battlePictures";
import "../../src/web/style.css";

const pictures = battlePictures(new URLSearchParams(location.search).has("heal") ? "heal" : "attack");
const app = requiredElement<HTMLElement>(document, "#app");
// Preserve the old picture's static fixture chrome; these buttons do not advance a game.
app.innerHTML = `<aside class="sequence-fixture-controls"><button type="button">戦闘を離れる</button><button type="button">戦闘を開始</button><output>確定 1回</output></aside><main class="battle-screen"><div class="game-board"><section class="stage"><canvas></canvas></section></div></main>`;
const board = requiredElement<HTMLDivElement>(app, ".game-board");
const canvas = requiredElement<HTMLCanvasElement>(app, "canvas");
const scene = createBattleScene(
  canvas,
  parseBattleSettings(savedSettings),
  pictures.definitions,
  projectBattleActors(pictures.initial.playback),
);
await scene.ready;
const view = createBattleView(board, scene, () => false);
async function paint(name: string) {
  const picture = pictures.samples.find((sample) => sample.name === name);
  if (!picture) throw new Error(`Unknown battle picture: ${name}`);
  scene.paintBattleFrame(projectBattleActors(picture.gpu.playback));
  const measure = view.paint(projectBattleView(picture.dom, pictures.input));
  if (measure)
    view.paint(
      projectBattleView(
        reduceBattleModel(picture.dom, pictures.input, { type: "party-measured", measure }).state,
        pictures.input,
      ),
    );
  await view.settled();
}
Object.assign(window, { paintBattlePicture: paint });
await paint(pictures.samples[0].name);
app.dataset.pictureReady = "true";
window.addEventListener("pagehide", (event) => {
  if (!event.persisted) {
    view.dispose();
    scene.dispose();
  }
});

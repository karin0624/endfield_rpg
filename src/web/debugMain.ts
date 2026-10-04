import savedAdventureSettings from "./adventure-settings.json";
import { parseAdventureSettings } from "./adventureSettings";
import savedSettings from "./battle-settings.json";
import type { createBattleScene } from "./battleScene";
import { parseBattleSettings } from "./battleSettings";
import "./style.css";
import "./debug.css";

const app = document.querySelector<HTMLDivElement>("#app");
if (app === null) throw new Error("#app が見つかりません");
const query = new URLSearchParams(location.search);
const editing = import.meta.env.DEV && query.get("edit") === "1";
const dungeonMode = query.get("dungeon") === "1";
const adventureEditing = import.meta.env.DEV && query.get("adventureEdit") === "1" && !dungeonMode;
const battleMode = editing || query.get("battle") === "1";
document.body.classList.toggle("editing", editing);
document.body.classList.toggle("adventure-editing", adventureEditing && !battleMode);
document.body.classList.toggle("dungeon-mode", dungeonMode && !battleMode);

let battle: ReturnType<typeof createBattleScene> | undefined;
let disposeAdventure: (() => void) | undefined;
let disposeAdventureEditor: (() => void) | undefined;
let disposeEditor: (() => void) | undefined;
let disposeBattleUi: (() => void) | undefined;
let disposed = false;
const events = new AbortController();

function dispose() {
  disposed = true;
  events.abort();
  disposeAdventureEditor?.();
  disposeAdventure?.();
  disposeEditor?.();
  disposeBattleUi?.();
  battle?.dispose();
}

window.addEventListener(
  "pagehide",
  (event) => {
    if (!event.persisted) dispose();
  },
  { signal: events.signal },
);
if (import.meta.hot) import.meta.hot.dispose(dispose);

if (!battleMode) {
  if (adventureEditing) {
    const { mountAdventureUi } = await import("./adventureUi");
    // This page's native owner can close while the module is loading.
    if (!disposed) {
      const adventure = mountAdventureUi(app, parseAdventureSettings(savedAdventureSettings), true);
      disposeAdventure = adventure.dispose;
      const { mountAdventureEditor } = await import("./adventureEditor");
      if (!disposed)
        disposeAdventureEditor = mountAdventureEditor(app, adventure, parseAdventureSettings(savedAdventureSettings));
    }
  } else {
    const { mountDebugSession } = await import("./debugSessionUi");
    if (!disposed) disposeAdventure = mountDebugSession(app, dungeonMode ? "dungeon" : "town", import.meta.env.DEV);
  }
} else {
  app.innerHTML = `
    <main class="battle-screen">
      <div class="game-board" data-board>
        <section class="stage" aria-label="荒野の戦闘画面">
          <canvas aria-label="3Dの地面に立つロッシ、ギルベルタ、青いスライム2体"></canvas>
          <div class="loading" role="status" data-status>戦闘画面を読み込んでいます…</div>
        </section>
      </div>
    </main>
  `;
  if (!editing) {
    const { mountDebugBattle } = await import("./debugBattleUi");
    if (!disposed) disposeBattleUi = mountDebugBattle(app, parseBattleSettings(savedSettings), import.meta.env.DEV);
  } else {
    const { createBattleScene } = await import("./battleScene");
    const { requiredElement } = await import("./requiredElement");
    const canvas = requiredElement<HTMLCanvasElement>(app, "canvas");
    const status = requiredElement<HTMLDivElement>(app, "[data-status]");
    try {
      const settings = parseBattleSettings(savedSettings);
      battle = createBattleScene(canvas, settings);
      await battle.ready;
      if (!disposed) {
        canvas.dataset.ready = "true";
        status.textContent = "表示準備完了";
        status.classList.add("sr-only");
        // Viteの配布ビルドでは、この分岐と設定UIのコードを含めない。
        const { mountBattleEditor } = await import("./battleEditor");
        if (!disposed) disposeEditor = mountBattleEditor(app, battle, settings);
      }
    } catch (error) {
      if (!disposed) {
        console.error(error);
        battle?.dispose();
        status.textContent =
          "戦闘画面を読み込めませんでした。素材の取得とWebGL対応を確認して、再読み込みしてください。";
        status.dataset.error = "true";
      }
    }
  }
}

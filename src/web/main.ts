import { characters } from "../content/characters";
import { initialAdventure } from "../content/initialAdventure";
import { initialDungeon } from "../content/initialDungeon";
import { initialGameOptions } from "../content/initialGameOptions";
import { createInitialGameState } from "../game/createInitialGameState";
import {
  actInExpedition,
  departOnExpedition,
  type ExpeditionGame,
  editExpeditionParty,
  leaveExpedition,
} from "../game/expedition";
import { characterById, createParty, getPartyCombatants } from "../game/party";
import savedAdventureSettings from "./adventure-settings.json";
import { parseAdventureSettings } from "./adventureSettings";
import savedSettings from "./battle-settings.json";
import type { createBattleScene } from "./battleScene";
import { parseBattleSettings } from "./battleSettings";
import "./style.css";

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
let disposeDungeon: (() => void) | undefined;
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
  disposeDungeon?.();
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
  const { mountAdventureUi } = await import("./adventureUi");
  const { mountDungeonUi } = await import("./dungeonUi");
  let game: ExpeditionGame = {
    adventure: createInitialGameState(initialGameOptions),
    party: createParty(characters, ["player"]),
    dungeon: null,
  };
  function showTown() {
    if (disposed || app === null) return;
    disposeDungeon?.();
    disposeDungeon = undefined;
    document.body.classList.remove("dungeon-mode");
    const adventureSettings = parseAdventureSettings(savedAdventureSettings);
    const adventure = mountAdventureUi(
      app,
      adventureSettings,
      adventureEditing
        ? undefined
        : {
            initialState: game.adventure,
            onChange: (state) => {
              game = { ...game, adventure: state };
            },
            party: {
              characters,
              getParty: () => game.party,
              edit: (slot, id) => {
                const result = editExpeditionParty(game, slot, id);
                game = result.state;
                return result;
              },
              depart: () => {
                const result = departOnExpedition(game, characters, initialDungeon, initialAdventure);
                game = result.state;
                if (result.accepted) showDungeon();
                return result;
              },
            },
          },
    );
    disposeAdventure = adventure.dispose;
    return adventure;
  }
  function showDungeon() {
    if (disposed || app === null || game.dungeon === null) return;
    disposeAdventure?.();
    disposeAdventure = undefined;
    document.body.classList.add("dungeon-mode");
    disposeDungeon = mountDungeonUi(app, {
      initialState: game.dungeon,
      combatants: getPartyCombatants(game.party, characters).map((member) => ({
        ...member,
        hp: characterById(characters, member.id).maxHp,
      })),
      displayNames: Object.fromEntries(characters.map(({ id, name }) => [id, name])),
      dispatch: (command) => {
        const update = actInExpedition(game, command, initialDungeon, initialAdventure);
        game = update.state;
        return update.result;
      },
      onReturn: () => {
        const result = leaveExpedition(game);
        game = result.state;
        if (result.accepted) showTown();
      },
    });
  }
  if (!disposed) {
    if (dungeonMode) {
      game = departOnExpedition(game, characters, initialDungeon, initialAdventure).state;
      showDungeon();
    } else {
      const adventure = showTown();
      if (adventureEditing && adventure) {
        const { mountAdventureEditor } = await import("./adventureEditor");
        if (!disposed)
          disposeAdventureEditor = mountAdventureEditor(app, adventure, parseAdventureSettings(savedAdventureSettings));
      }
    }
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
  const { createBattleScene } = await import("./battleScene");
  const { mountBattleUi } = await import("./battleUi");
  const { requiredElement } = await import("./requiredElement");
  const canvas = requiredElement<HTMLCanvasElement>(app, "canvas");
  const status = requiredElement<HTMLDivElement>(app, "[data-status]");
  const board = requiredElement<HTMLDivElement>(app, "[data-board]");

  try {
    const settings = parseBattleSettings(savedSettings);
    battle = createBattleScene(canvas, settings);
    await battle.ready;
    if (!disposed) {
      canvas.dataset.ready = "true";
      status.textContent = "表示準備完了";
      status.classList.add("sr-only");
      if (editing) {
        // Viteの配布ビルドでは、この分岐と設定UIのコードを含めない。
        const { mountBattleEditor } = await import("./battleEditor");
        if (!disposed) disposeEditor = mountBattleEditor(app, battle, settings);
      } else {
        disposeBattleUi = mountBattleUi(board, battle);
        const utilities = document.createElement("div");
        utilities.className = "battle-utility-controls";
        utilities.innerHTML = `<a href="${import.meta.env.BASE_URL}">街へ戻る</a>
          ${import.meta.env.DEV ? '<a href="?edit=1">構図設定</a>' : ""}`;
        app.append(utilities);
      }
    }
  } catch (error) {
    if (!disposed) {
      console.error(error);
      battle?.dispose();
      status.textContent = "戦闘画面を読み込めませんでした。素材の取得とWebGL対応を確認して、再読み込みしてください。";
      status.dataset.error = "true";
    }
  }
}

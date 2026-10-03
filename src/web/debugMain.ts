import { characters } from "../content/characters";
import { growthRules } from "../content/growthRules";
import { initialAdventure } from "../content/initialAdventure";
import { initialDungeon } from "../content/initialDungeon";
import { initialGameOptions } from "../content/initialGameOptions";
import { mentalFatigueDefinition } from "../content/mentalFatigueDefinition";
import { saveDefinitions } from "../content/saveDefinitions";
import { skillCatalog } from "../content/skillDefinitions";
import { createInitialGameState } from "../game/createInitialGameState";
import {
  actInExpedition,
  actInTown,
  beginTownExploration,
  confirmExpeditionParty,
  departOnExpedition,
  type ExpeditionGame,
  type GameActionCompletion,
  leaveExpedition,
} from "../game/expedition";
import { chooseGrowthSkill, grownCharacters, hasPendingGrowth } from "../game/growthRuntime";
import { characterById, createParty, getPartyCombatants } from "../game/party";
import { effectiveMaxHp, healthyStatus } from "../game/status";
import savedAdventureSettings from "./adventure-settings.json";
import { parseAdventureSettings } from "./adventureSettings";
import savedSettings from "./battle-settings.json";
import type { createBattleScene } from "./battleScene";
import { parseBattleSettings } from "./battleSettings";
import { mountGrowthChoice } from "./growthChoiceUi";
import "./style.css";
import "./debug.css";
import { DEBUG_SAVE_KEY, loadSlot, saveSlot } from "./saveSlot";
import { calendarLabel, completionFeedback, mentalFatigueText, symptomLabel } from "./sessionFeedback";

const app = document.querySelector<HTMLDivElement>("#app");
if (app === null) throw new Error("#app が見つかりません");
const skillRules = { catalog: skillCatalog, fatigue: mentalFatigueDefinition, growth: growthRules };
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
  let completion: GameActionCompletion | undefined;
  function showTown(saveMessage = "") {
    if (disposed || app === null) return;
    disposeAdventure?.();
    disposeAdventure = undefined;
    disposeDungeon?.();
    disposeDungeon = undefined;
    document.body.classList.remove("dungeon-mode");
    if (hasPendingGrowth(game) && game.growth) {
      disposeAdventure = mountGrowthChoice(
        app,
        game.growth,
        skillCatalog,
        Object.fromEntries(characters.map(({ id, name }) => [id, name])),
        (input) => {
          const result = chooseGrowthSkill(game, input, skillRules);
          game = result.state;
          showTown();
        },
      );
      return;
    }
    const adventureSettings = parseAdventureSettings(savedAdventureSettings);
    const adventure = mountAdventureUi(
      app,
      adventureSettings,
      adventureEditing
        ? undefined
        : {
            debug: true,
            initialState: game.adventure,
            getCalendarLabel: () => calendarLabel(game.clock),
            saveMessage,
            save: () => saveSlot(game, saveDefinitions, undefined, DEBUG_SAVE_KEY),
            load: () => {
              const result = loadSlot(game, saveDefinitions, undefined, DEBUG_SAVE_KEY);
              if (result.state) {
                game = result.state;
                completion = undefined;
                showTown(result.message);
              }
              return result.message;
            },
            getFeedback: () => [
              ...completionFeedback(completion, characters),
              ...(completion?.returnedIds ?? []).flatMap((id) => {
                const member = game.party.members.find((candidate) => candidate.id === id);
                const label = [
                  symptomLabel(member?.status ?? healthyStatus()),
                  (member?.mentalFatigue ?? 0) > 0 ? `精神疲労 ${mentalFatigueText(member?.mentalFatigue ?? 0)}` : "",
                ]
                  .filter(Boolean)
                  .join(" / ");
                return label ? [`${characterById(characters, id).name} · ${label}`] : [];
              }),
            ],
            dispatch: (command, actionId) => {
              const result =
                command.type === "select"
                  ? beginTownExploration(game, command.placeId, initialAdventure)
                  : actInTown(
                      game,
                      actionId ?? -1,
                      command,
                      characters,
                      initialAdventure,
                      mentalFatigueDefinition,
                      skillRules,
                    );
              game = result.state;
              if (result.accepted) completion = result.completion;
              if (hasPendingGrowth(game)) queueMicrotask(() => showTown());
              return result.accepted
                ? {
                    accepted: true,
                    state: game.adventure,
                    actionId: game.clock?.pendingAction?.id,
                    recruitedNames: result.completion?.recruitedIds?.map((id) => characterById(characters, id).name),
                  }
                : { accepted: false, state: game.adventure, reason: "conversation-progress-invalid" };
            },
            party: {
              characters: grownCharacters(game, skillRules),
              getDetailsContext: () => ({
                characters: grownCharacters(game, skillRules),
                baseCharacters: characters,
                growth: game.growth,
                rules: skillRules,
              }),
              getParty: () => game.party,
              getCalendarLabel: () => calendarLabel(game.clock),
              confirm: (slots) => {
                const result = confirmExpeditionParty(game, slots);
                game = result.state;
                return result;
              },
              depart: () => {
                const result = departOnExpedition(game, characters, initialDungeon, initialAdventure, skillRules);
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
    const actionId = game.clock?.pendingAction?.id;
    disposeDungeon = mountDungeonUi(app, {
      allowBasicAttack: true,
      initialState: game.dungeon,
      getGrowth: () => game.growth,
      chooseGrowth: (input) => {
        const result = chooseGrowthSkill(game, input, skillRules);
        game = result.state;
        return game.dungeon ?? undefined;
      },
      skillRules,
      calendarLabel: calendarLabel(game.clock),
      combatants: getPartyCombatants(game.party, characters).map((member) => ({
        ...member,
        hp: effectiveMaxHp(characterById(characters, member.id).maxHp, member.status ?? healthyStatus()),
      })),
      displayNames: Object.fromEntries(characters.map(({ id, name }) => [id, name])),
      dispatch: (command) => {
        const update = actInExpedition(game, command, initialDungeon, initialAdventure, skillRules);
        game = update.state;
        if (update.completion) completion = update.completion;
        return update.result;
      },
      onReturn: () => {
        if (game.dungeon === null) {
          showTown();
          return;
        }
        const result = leaveExpedition(game, actionId, skillRules);
        game = result.state;
        if (result.accepted) {
          completion = result.completion;
          showTown();
        }
      },
    });
  }
  if (!disposed) {
    if (dungeonMode) {
      game = departOnExpedition(game, characters, initialDungeon, initialAdventure, skillRules).state;
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
        utilities.innerHTML = `<a href="?debug=1">街へ戻る</a>
          ${import.meta.env.DEV ? '<a href="?debug=1&edit=1">構図設定</a>' : ""}`;
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

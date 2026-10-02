import { characters } from "../../src/content/characters";
import { growthRules } from "../../src/content/growthRules";
import { initialAdventure } from "../../src/content/initialAdventure";
import { initialBattleCombatants } from "../../src/content/initialBattle";
import { initialDungeon } from "../../src/content/initialDungeon";
import { initialGameOptions } from "../../src/content/initialGameOptions";
import { mentalFatigueDefinition } from "../../src/content/mentalFatigueDefinition";
import { skillCatalog } from "../../src/content/skillDefinitions";
import { createInitialGameState } from "../../src/game/createInitialGameState";
import { actInExpedition, applyPartyStatus, departOnExpedition, type ExpeditionGame } from "../../src/game/expedition";
import { chooseGrowthSkill } from "../../src/game/growthRuntime";
import { createParty, getPartyCombatants } from "../../src/game/party";
import type { ActiveSkillDefinition, SkillCatalog } from "../../src/game/skills";
import savedSettings from "../../src/web/battle-settings.json";
import { parseBattleSettings } from "../../src/web/battleSettings";
import { mountBattleUi } from "../../src/web/battleUi";
import { mountDungeonUi } from "../../src/web/dungeonUi";
import { requiredElement } from "../../src/web/requiredElement";
import "../../src/web/style.css";
import { createUiTestRenderer } from "./battle-presentation";

const app = requiredElement<HTMLDivElement>(document, "#app");
const settings = parseBattleSettings(savedSettings);
let dispose: () => void;

if (new URLSearchParams(location.search).has("demo")) {
  app.innerHTML = `<main class="battle-screen"><div class="game-board" data-board>
    <section class="stage"><canvas aria-label="描画を代替した戦闘UI"></canvas></section>
  </div></main>`;
  const board = requiredElement<HTMLDivElement>(app, "[data-board]");
  const renderer = createUiTestRenderer(requiredElement<HTMLCanvasElement>(board, "canvas"), settings);
  const battle = renderer.beginBattle(initialBattleCombatants);
  const disposeUi = mountBattleUi(board, battle);
  dispose = () => {
    disposeUi();
    renderer.dispose();
  };
} else {
  // Isolated authored inputs exercise production runtime/UI; never change the shipped catalog.
  const attacks: readonly ActiveSkillDefinition[] = [
    {
      id: "fixture-repeat",
      name: "連続攻撃（試験入力）",
      description: "選んだ敵を3回攻撃",
      tier: "normal",
      type: "active",
      effect: { type: "damage", amount: 0, scaling: { stat: "attackPower", coefficient: 0.5 }, hitCount: 3 },
      mentalFatigueIncrease: 4,
      scenes: ["battle"],
      target: "single-enemy",
    },
    {
      id: "fixture-sweep",
      name: "全体攻撃（試験入力）",
      description: "生存中の敵を攻撃",
      tier: "normal",
      type: "active",
      effect: { type: "damage", amount: 12, scaling: { stat: "attackPower", coefficient: 0.5 } },
      mentalFatigueIncrease: 4,
      scenes: ["battle"],
      target: "all-enemies",
    },
  ];
  const attackCatalog: SkillCatalog = {
    ...skillCatalog,
    skills: [...skillCatalog.skills, ...attacks],
    characters: skillCatalog.characters.map((profile) => ({
      ...profile,
      initialSkillIds: attacks.map((skill) => skill.id),
    })),
  };
  const skillRules = {
    catalog: new URLSearchParams(location.search).has("multi") ? attackCatalog : skillCatalog,
    fatigue: mentalFatigueDefinition,
    ...(new URLSearchParams(location.search).has("growth") ? { growth: growthRules } : {}),
  };
  let game: ExpeditionGame = {
    adventure: createInitialGameState(initialGameOptions),
    party: createParty(characters, ["player"]),
    dungeon: null,
  };
  if (new URLSearchParams(location.search).has("symptoms")) {
    game = applyPartyStatus(game, "player", { kind: "physicalFatigue", amount: 75 }, characters);
    game = applyPartyStatus(game, "player", { kind: "haze", amount: 75 }, characters);
    game = {
      ...game,
      party: { ...game.party, members: game.party.members.map((member) => ({ ...member, mentalFatigue: 100 })) },
    };
  }
  game = departOnExpedition(game, characters, initialDungeon, initialAdventure, skillRules).state;
  if (!game.dungeon) throw new Error("探索を開始できませんでした");
  document.body.classList.add("dungeon-mode");
  dispose = mountDungeonUi(app, {
    initialState: game.dungeon,
    getGrowth: () => game.growth,
    chooseGrowth(input) {
      const result = chooseGrowthSkill(game, input, skillRules);
      game = result.state;
      return game.dungeon ?? undefined;
    },
    skillRules,
    calendarLabel: "UI操作テスト",
    combatants: getPartyCombatants(game.party, characters),
    displayNames: Object.fromEntries(characters.map(({ id, name }) => [id, name])),
    createRenderer: createUiTestRenderer,
    dispatch(command) {
      const update = actInExpedition(game, command, initialDungeon, initialAdventure, skillRules);
      game = update.state;
      return update.result;
    },
    onReturn() {
      dispose();
      app.textContent = "探索UIを終了しました";
    },
  });
}
window.addEventListener("pagehide", () => dispose(), { once: true });

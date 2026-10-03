import { mentalFatigueDefinition } from "../../src/content/mentalFatigueDefinition";
import { skillCatalog } from "../../src/content/skillDefinitions";
import {
  advanceBattleToNextAllyInput,
  type BattleCombatantDefinition,
  createBattleState,
  performBattleSkillAndAdvanceToAllyInput,
} from "../../src/game/battle";
import savedSettings from "../../src/web/battle-settings.json";
import { createBattleScene } from "../../src/web/battleScene";
import { parseBattleSettings } from "../../src/web/battleSettings";
import { mountBattleUi } from "../../src/web/battleUi";
import { requiredElement } from "../../src/web/requiredElement";
import { createUiTestRenderer } from "./battle-presentation";
import "../../src/web/style.css";

const query = new URLSearchParams(location.search);
const rules = { catalog: skillCatalog, fatigue: mentalFatigueDefinition };
const definitions: readonly BattleCombatantDefinition[] = [
  {
    id: "player",
    team: "ally",
    speed: 100,
    hp: 10,
    maxHp: 30,
    attackPower: 8,
    hitRate: query.has("miss") ? 0 : 1,
    ...(query.has("symptom")
      ? { mentalFatigue: 100, status: { physicalFatigue: 75, haze: 75, incapacityRecoverySteps: null } }
      : {}),
    learnedSkills: [
      { skillId: "test-strike", type: "active", origin: "initial", acquisition: "initial" },
      { skillId: "test-heal", type: "active", origin: "initial", acquisition: "initial" },
    ],
  },
  ...(query.has("party")
    ? [
        {
          id: "gilberta",
          team: "ally" as const,
          speed: 90,
          hp: 4,
          maxHp: 30,
          attackPower: 6,
          learnedSkills: [
            {
              skillId: "test-heal",
              type: "active" as const,
              origin: "initial" as const,
              acquisition: "initial" as const,
            },
          ],
        },
      ]
    : []),
  { id: "slime", team: "enemy", speed: query.has("party") || query.has("symptom") ? 80 : 40, hp: 40, attackPower: 4 },
];
const app = requiredElement<HTMLElement>(document, "#app");
app.innerHTML = `<aside class="sequence-fixture-controls"><button type="button" data-exit>戦闘を離れる</button><button type="button" data-reenter>戦闘を開始</button><output data-count>確定 0回</output></aside><main class="battle-screen"><div class="game-board"><section class="stage"><canvas></canvas></section></div></main>`;
const board = requiredElement<HTMLDivElement>(app, ".game-board");
const canvas = requiredElement<HTMLCanvasElement>(app, "canvas");
const settings = parseBattleSettings(savedSettings);
let dispose = () => {};
let count = 0;
async function enter() {
  dispose();
  const renderer = query.has("real")
    ? createBattleScene(canvas, settings, definitions)
    : createUiTestRenderer(canvas, settings).beginBattle(definitions);
  await renderer.ready;
  const ui = mountBattleUi(board, renderer, {
    combatants: definitions,
    initialState: advanceBattleToNextAllyInput(createBattleState(definitions)).state,
    skillRules: rules,
    useSkill(state, actorId, targetId, skillId) {
      const result = performBattleSkillAndAdvanceToAllyInput(
        state,
        actorId,
        targetId,
        skillId,
        state.logicalTime,
        rules.catalog,
        rules.fatigue,
      );
      if (result.accepted) requiredElement<HTMLElement>(app, "[data-count]").textContent = `確定 ${++count}回`;
      return result;
    },
  });
  dispose = () => {
    ui();
    renderer.dispose();
  };
}
requiredElement<HTMLElement>(app, "[data-exit]").addEventListener("click", () => dispose());
requiredElement<HTMLElement>(app, "[data-reenter]").addEventListener("click", () => {
  void enter();
});
await enter();

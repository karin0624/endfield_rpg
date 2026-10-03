import { initialAdventure } from "../../src/content/initialAdventure";
import { initialDungeon } from "../../src/content/initialDungeon";
import { itemCatalog, recoveryItemId } from "../../src/content/itemSettings";
import { mentalFatigueDefinition } from "../../src/content/mentalFatigueDefinition";
import { skillCatalog } from "../../src/content/skillDefinitions";
import {
  advanceBattleToNextAllyInput,
  type BattleCombatantDefinition,
  createBattleState,
  performBattleSkillAndAdvanceToAllyInput,
} from "../../src/game/battle";
import { createDungeonState } from "../../src/game/dungeon";
import { bagItemQuantity, createItemState, packItems } from "../../src/game/items";
import { useBattleRecoveryItem } from "../../src/game/itemUse";
import { createParty, getPartyCombatants, setPartySlot } from "../../src/game/party";
import { healthyStatus } from "../../src/game/status";
import savedSettings from "../../src/web/battle-settings.json";
import { parseBattleSettings } from "../../src/web/battleSettings";
import { mountBattleUi } from "../../src/web/battleUi";
import { mountBranchSkillUi } from "../../src/web/branchSkillUi";
import { createUiTestRenderer } from "./battle-presentation";
import "../../src/web/style.css";

const query = new URLSearchParams(location.search);
const characters = ["player", "gilberta", "third", "blocked", "reserve"].map((id, i) => ({
  id,
  name: ["Player", "Ally2", "Ally3", "Blocked", "Reserve"][i],
  maxHp: 30,
  attackPower: 8,
  speed: 100 - i * 10,
}));
const branchOnly = { ...skillCatalog.skills[1], id: "branch-only", name: "分岐専用", scenes: ["branch"] as const };
const catalog = {
  ...skillCatalog,
  skills: [
    ...skillCatalog.skills.map((skill) =>
      query.has("onset") && skill.id === "test-strike" ? { ...skill, mentalFatigueIncrease: 100 } : skill,
    ),
    branchOnly,
  ],
  characters: characters.map(({ id }) => ({
    characterId: id,
    poolId: "test-shared",
    initialSkillIds:
      id === "player"
        ? ["test-strike", "test-heal", "test-strength", "branch-only"]
        : id === "gilberta"
          ? ["test-heal"]
          : ["test-strike"],
  })),
};
let party = createParty(
  characters,
  characters.map(({ id }) => id),
);
const count = Number(query.get("count") ?? 4);
for (let slot = 1; slot < count; slot++) {
  const edit = setPartySlot(party, slot, characters[slot].id);
  if (!edit.accepted) throw new Error(edit.reason);
  party = edit.state;
}
let allies = getPartyCombatants(party, characters, catalog);
if (query.has("unavailable"))
  allies = allies.map((member) => ({
    ...member,
    hp: member.id === "player" ? 28 : member.id === "third" ? 0 : 10,
    ...(member.id === "blocked" ? { status: { ...healthyStatus(), incapacityRecoverySteps: 6 } } : {}),
  }));
if (query.has("symptoms"))
  allies = allies.map((member) =>
    member.id === "player"
      ? { ...member, mentalFatigue: 1, status: { physicalFatigue: 1, haze: 1, incapacityRecoverySteps: 6 } }
      : member,
  );
if (query.has("allblocked"))
  allies = allies.map((member) => ({ ...member, status: { ...healthyStatus(), incapacityRecoverySteps: 6 } }));
const names = Object.fromEntries(characters.map(({ id, name }) => [id, name]));
const app = document.querySelector<HTMLElement>("#app");
if (!app) throw new Error("app missing");
if (query.has("branch")) {
  const state = createDungeonState(initialDungeon, initialAdventure, allies);
  mountBranchSkillUi(
    app,
    state,
    { catalog, fatigue: mentalFatigueDefinition },
    names,
    () => {
      throw new Error("This fixture tests selection and cancellation only");
    },
    () => {},
  );
} else {
  const enemies: BattleCombatantDefinition[] = ["slime", "slime-2", "third-enemy"].map((id) => ({
    id,
    team: "enemy",
    hp: 14,
    speed: 1,
    attackPower: 0,
  }));
  const definitions = [...allies, ...enemies];
  app.innerHTML =
    '<main class="battle-screen"><div class="game-board"><section class="stage"><canvas></canvas></section></div></main>';
  const board = app.querySelector<HTMLDivElement>(".game-board");
  const canvas = app.querySelector<HTMLCanvasElement>("canvas");
  if (!board || !canvas) throw new Error("stage missing");
  const renderer = createUiTestRenderer(canvas, parseBattleSettings(savedSettings)).beginBattle(definitions);
  await renderer.ready;
  const stock = [{ itemId: recoveryItemId, quantity: 2 }];
  const packed = packItems(createItemState(stock, itemCatalog), 0, 1, "dungeon", stock, itemCatalog);
  if (!packed.accepted) throw new Error(packed.reason);
  let items = packed.state;
  let confirmed = advanceBattleToNextAllyInput(createBattleState(definitions)).state;
  let commits = 0;
  let refused = false;
  Object.assign(window, { inspectBattleContracts: () => JSON.parse(JSON.stringify({ confirmed, items, commits })) });
  mountBattleUi(board, renderer, {
    combatants: definitions,
    displayNames: { ...names, slime: "Enemy A", "slime-2": "Enemy B", "third-enemy": "Enemy C" },
    initialState: confirmed,
    skillRules: { catalog, fatigue: mentalFatigueDefinition },
    itemCount: () => bagItemQuantity(items, recoveryItemId),
    useItem(state, actorId, targetId) {
      if (query.has("refuse-once") && !refused) {
        refused = true;
        return { accepted: false, reason: "競合" };
      }
      const used = useBattleRecoveryItem(
        items,
        state,
        {
          expectedVersion: items.version,
          explorationId: 1,
          itemId: recoveryItemId,
          actorId,
          targetId,
          expectedActionTime: state.logicalTime,
        },
        itemCatalog,
      );
      if (!used.accepted) return { accepted: false, reason: "使用不可" };
      items = used.items;
      const result = advanceBattleToNextAllyInput(used.battle);
      confirmed = result.state;
      commits++;
      return { accepted: true, state: result.state, events: result.events, itemRecovery: used.event };
    },
    useSkill(state, actorId, targetId, skillId) {
      const result = performBattleSkillAndAdvanceToAllyInput(
        state,
        actorId,
        targetId,
        skillId,
        state.logicalTime,
        catalog,
        mentalFatigueDefinition,
      );
      if (result.accepted) {
        confirmed = result.state;
        commits++;
      }
      return result;
    },
  });
}

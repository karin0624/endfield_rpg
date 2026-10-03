import { describe, expect, it } from "vitest";
import { characters } from "../content/characters";
import { growthRules } from "../content/growthRules";
import { initialAdventure } from "../content/initialAdventure";
import { initialDungeon } from "../content/initialDungeon";
import { initialGameOptions } from "../content/initialGameOptions";
import { itemCatalog, recoveryItemId, recoveryItemOffer } from "../content/itemSettings";
import { mentalFatigueDefinition } from "../content/mentalFatigueDefinition";
import { saveDefinitions } from "../content/saveDefinitions";
import { skillCatalog } from "../content/skillDefinitions";
import { createInitialGameState } from "./createInitialGameState";
import { editHomeEquipment } from "./equipmentRuntime";
import {
  actInExpedition,
  actInTown,
  beginTownExploration,
  departOnExpedition,
  type ExpeditionGame,
  leaveExpedition,
} from "./expedition";
import { grownCharacters } from "./growthRuntime";
import { createInventory } from "./inventory";
import { purchaseItem } from "./itemPurchase";
import { bagItemQuantity, createItemState } from "./items";
import { createParty } from "./party";
import { deserializeGame, serializeGame } from "./save";

const rules = { catalog: skillCatalog, growth: growthRules, fatigue: mentalFatigueDefinition };
function initial(): ExpeditionGame {
  return {
    adventure: createInitialGameState(initialGameOptions),
    party: createParty(characters, ["player", "gilberta"]),
    dungeon: null,
    inventory: createInventory(),
    randomState: 1,
  };
}
function roundTrip(game: ExpeditionGame) {
  const saved = serializeGame(game, saveDefinitions);
  if (!saved.accepted) throw new Error(saved.reason);
  const read = deserializeGame(saved.data, saveDefinitions);
  if (!read.accepted) throw new Error(read.reason);
  return read.state;
}
function withGear(): ExpeditionGame {
  const game = initial();
  return {
    ...game,
    inventory: {
      ...createInventory(),
      equipment: {
        owned: [
          { instanceId: "w1", definitionId: "trial-weapon" },
          { instanceId: "a1", definitionId: "trial-armor" },
        ],
        assignments: [],
      },
    },
  };
}
describe("本編の物品・装備接続", () => {
  it("市場で買物を複数回しても完了まで時間を進めず、持帰り・保存・持込み・途中帰還が一度だけ反映される", () => {
    let game = beginTownExploration(initial(), "market", initialAdventure).state;
    const actionId = game.clock?.pendingAction?.id ?? -1;
    for (let i = 0; i < 3; i++) {
      if (!game.inventory) throw new Error("inventory");
      const bought = purchaseItem(
        game.inventory.items,
        game.inventory.balance,
        recoveryItemOffer,
        {
          quantity: 1,
          explorationId: actionId,
          expectedVersion: game.inventory.items.version,
          transactionId: String(i),
        },
        itemCatalog,
      );
      expect(bought.accepted).toBe(true);
      game = { ...game, inventory: { ...game.inventory, items: bought.items, balance: bought.balance } };
      expect(game.clock?.elapsedHalfDays).toBe(0);
      expect(serializeGame(game, saveDefinitions).accepted).toBe(false);
    }
    const completed = actInTown(game, actionId, { type: "advance" }, characters, initialAdventure);
    expect(completed.accepted).toBe(true);
    game = roundTrip(completed.state);
    expect(game.clock?.elapsedHalfDays).toBe(1);
    expect(game.inventory?.balance).toBe(0);
    expect(game.inventory?.items.home).toEqual([{ itemId: recoveryItemId, quantity: 3 }]);
    expect(actInTown(game, actionId, { type: "advance" }, characters, initialAdventure).accepted).toBe(false);
    game = departOnExpedition(game, characters, initialDungeon, initialAdventure, undefined, [
      { itemId: recoveryItemId, quantity: 2 },
    ]).state;
    expect(game.inventory?.items.home).toEqual([{ itemId: recoveryItemId, quantity: 1 }]);
    const returned = leaveExpedition(game);
    expect(returned.accepted).toBe(true);
    game = roundTrip(returned.state);
    expect(game.inventory?.items.home).toEqual([{ itemId: recoveryItemId, quantity: 3 }]);
    expect(game.randomState).toBe(1586005467);
    expect(game.clock?.elapsedHalfDays).toBe(2);
    expect(leaveExpedition(game).accepted).toBe(false);
  });
  it("戦闘使用は敵行動まで進め、名簿とバッグを確定し、前ノード・同じ入力の再送を拒否する", () => {
    let game = initial();
    game = {
      ...game,
      inventory: {
        ...createInventory(),
        items: createItemState([{ itemId: recoveryItemId, quantity: 2 }], itemCatalog),
      },
    };
    game = departOnExpedition(game, characters, initialDungeon, initialAdventure, undefined, [
      { itemId: recoveryItemId, quantity: 2 },
    ]).state;
    game = actInExpedition(game, { type: "enter", nodeId: "battle-a" }, initialDungeon, initialAdventure).state;
    game = actInExpedition(
      game,
      { type: "attack", actorId: "player", targetId: "slime" },
      initialDungeon,
      initialAdventure,
    ).state;
    const battle = game.dungeon?.activity;
    if (battle?.type !== "battle" || !game.inventory) throw new Error("battle");
    const input = {
      type: "item" as const,
      actorId: "player",
      targetId: "player",
      itemId: recoveryItemId,
      expectedActionTime: battle.state.logicalTime,
      expectedNodeId: "battle-a",
      expectedVersion: game.inventory.items.version,
      explorationId: game.dungeon?.expeditionActionId ?? -1,
    };
    expect(
      actInExpedition(game, { ...input, expectedNodeId: "entrance" }, initialDungeon, initialAdventure).result.accepted,
    ).toBe(false);
    const used = actInExpedition(game, input, initialDungeon, initialAdventure);
    expect(used.result.accepted).toBe(true);
    if (used.result.accepted) expect(used.result.itemRecovery?.type).toBe("item-recovery");
    expect(used.state.inventory && bagItemQuantity(used.state.inventory.items, recoveryItemId)).toBe(1);
    expect(used.state.party.members[0].mentalFatigue ?? 0).toBe(0);
    expect(actInExpedition(used.state, input, initialDungeon, initialAdventure).result.accepted).toBe(false);
  });
  it("共有実物は同時装備不可で、装着で回復せず、解除時はHP上限へ収める", () => {
    let game = editHomeEquipment(withGear(), "home", "player", "armor", "a1", characters, rules).state;
    expect(game.party.members[0].hp).toBe(20);
    expect(grownCharacters(game, rules)[0].maxHp).toBe(24);
    expect(editHomeEquipment(game, "home", "gilberta", "armor", "a1", characters, rules).accepted).toBe(false);
    expect(editHomeEquipment(game, "exploration", "player", "armor", null, characters, rules).accepted).toBe(false);
    game = departOnExpedition(game, characters, initialDungeon, initialAdventure, rules).state;
    expect(editHomeEquipment(game, "home", "player", "armor", null, characters, rules).accepted).toBe(false);
    game = leaveExpedition(game, undefined, rules).state;
    expect(game.party.members[0].hp).toBe(24);
    expect(game.inventory?.equipment.owned).toHaveLength(2);
    game = roundTrip(game);
    game = editHomeEquipment(game, "home", "player", "armor", null, characters, rules).state;
    expect(game.party.members[0].hp).toBe(20);
    expect(editHomeEquipment(game, "home", "gilberta", "armor", "a1", characters, rules).accepted).toBe(true);
  });
  it("装備補正は成長へ重ねず、戦闘・帰還・保存に同じ値を使う", () => {
    let game = editHomeEquipment(withGear(), "home", "player", "weapon", "w1", characters, rules).state;
    game = departOnExpedition(game, characters, initialDungeon, initialAdventure, rules).state;
    expect(game.dungeon?.party[0].attackPower).toBe(9);
    game = leaveExpedition(game, undefined, rules).state;
    game = roundTrip(game);
    expect(grownCharacters(game, rules)[0].attackPower).toBe(9);
    game = departOnExpedition(game, characters, initialDungeon, initialAdventure, rules).state;
    expect(game.dungeon?.party[0].attackPower).toBe(9);
  });
  it("旧形式・負数・未知物品・装備の重複割当てを保存復元で拒否する", () => {
    const saved = serializeGame(withGear(), saveDefinitions);
    if (!saved.accepted) throw new Error(saved.reason);
    for (const mutate of [
      (v: {
        version: number;
        inventory: {
          balance: number;
          items: { home: { itemId: string; quantity: number }[] };
          equipment: { assignments: { characterId: string; weapon: string | null; armor: string | null }[] };
        };
      }) => {
        v.version = 4;
      },
      (v: {
        version: number;
        inventory: {
          balance: number;
          items: { home: { itemId: string; quantity: number }[] };
          equipment: { assignments: { characterId: string; weapon: string | null; armor: string | null }[] };
        };
      }) => {
        v.inventory.balance = -1;
      },
      (v: {
        version: number;
        inventory: {
          balance: number;
          items: { home: { itemId: string; quantity: number }[] };
          equipment: { assignments: { characterId: string; weapon: string | null; armor: string | null }[] };
        };
      }) => {
        v.inventory.items.home = [{ itemId: "unknown", quantity: 1 }];
      },
      (v: {
        version: number;
        inventory: {
          balance: number;
          items: { home: { itemId: string; quantity: number }[] };
          equipment: { assignments: { characterId: string; weapon: string | null; armor: string | null }[] };
        };
      }) => {
        v.inventory.equipment.assignments = [
          { characterId: "player", weapon: "w1", armor: null },
          { characterId: "gilberta", weapon: "w1", armor: null },
        ];
      },
    ]) {
      const payload = JSON.parse(saved.data);
      mutate(payload);
      expect(deserializeGame(JSON.stringify(payload), saveDefinitions).accepted).toBe(false);
    }
  });
});

describe("物品・装備の保存契約", () => {
  it.each([
    ["ゼロ個の保管", "items.home", [{ itemId: recoveryItemId, quantity: 0 }]],
    ["端数個の保管", "items.home", [{ itemId: recoveryItemId, quantity: 1.5 }]],
    [
      "同じ品目の二重保管",
      "items.home",
      [
        { itemId: recoveryItemId, quantity: 1 },
        { itemId: recoveryItemId, quantity: 2 },
      ],
    ],
    ["未知の装備定義", "equipment.owned", [{ instanceId: "w1", definitionId: "unknown" }]],
    ["空の実物ID", "equipment.owned", [{ instanceId: "  ", definitionId: "trial-weapon" }]],
    [
      "重複した実物ID",
      "equipment.owned",
      [
        { instanceId: "w1", definitionId: "trial-weapon" },
        { instanceId: "w1", definitionId: "trial-weapon" },
      ],
    ],
    ["所持しない実物の装備", "equipment.assignments", [{ characterId: "player", weapon: "missing", armor: null }]],
    ["防具を武器枠へ配置", "equipment.assignments", [{ characterId: "player", weapon: "a1", armor: null }]],
    ["武器を防具枠へ配置", "equipment.assignments", [{ characterId: "player", weapon: null, armor: "w1" }]],
    ["未加入キャラへの配置", "equipment.assignments", [{ characterId: "missing", weapon: "w1", armor: null }]],
    [
      "同じキャラへの二重行",
      "equipment.assignments",
      [
        { characterId: "player", weapon: "w1", armor: null },
        { characterId: "player", weapon: null, armor: "a1" },
      ],
    ],
  ])("%sを復元時に拒否する", (_label, path, replacement) => {
    const saved = serializeGame(withGear(), saveDefinitions);
    if (!saved.accepted) throw new Error(saved.reason);
    const payload = JSON.parse(saved.data);
    const [group, field] = String(path).split(".");
    payload.inventory[group][field] = replacement;
    expect(deserializeGame(JSON.stringify(payload), saveDefinitions)).toEqual({
      accepted: false,
      reason: "invalid-data",
    });
  });

  it("保存読込は消耗品・所持金・共有装備を初期配布で補充しない", () => {
    const game = {
      ...initial(),
      inventory: {
        balance: 0,
        items: createItemState([], itemCatalog),
        equipment: { owned: [], assignments: [] },
      },
    };
    const loaded = roundTrip(game);
    expect(loaded.inventory).toEqual({
      balance: 0,
      items: { version: 0, home: [], importantIds: [], exploration: null },
      equipment: { owned: [], assignments: [] },
    });
  });
});
